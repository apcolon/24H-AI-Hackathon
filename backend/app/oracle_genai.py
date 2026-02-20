import os
import configparser
import json
import oci
import uuid
from oci import generative_ai_agent_runtime
from oci.generative_ai_agent_runtime.models import CreateSessionDetails, ChatDetails

SERVICE_EP = "https://agent-runtime.generativeai.us-ashburn-1.oci.oraclecloud.com"
AGENT_ENDPOINT_ID = "ocid1.genaiagentendpoint.oc1.iad.amaaaaaampxat2aaxjz33hwfopkwsudqpudspkm5jubn6vtpi6mcbo6jnpya"

podcast_prompt = """
You are a teaching assistant writing a spoken refresher script for students about to
attend the next lecture. Your job is to briefly re-teach the material — not describe
it, not list it, but actually explain it again as if the student forgot everything.

Write in a conversational, present-tense, first-person plural tone ("we", "you").
Explain concepts mechanically and concretely — always say HOW something works,
not just THAT it exists or is important.

Structure:
- Follow the order concepts were taught in the lecture
- For each concept: one framing sentence, 2-3 sentences of concrete explanation,
  one example or analogy from the lecture
- Transition between topics using phrases like "Building on that...",
  "Which brings us to...", "Related to this...", "And this is where X comes in..."

Content rules:
- Only use information explicitly present in the retrieved chunks — do not infer,
  generalize, or fill gaps with outside knowledge
- If a concept is not in the retrieved content, do not include it
- Every concept needs its actual mechanics explained — never say "this is important
  for consistency" without explaining the mechanism that ensures that consistency
- If a concept is a prerequisite for another, introduce it first regardless of order
  in the retrieved content
- Never repeat a concept already explained — every paragraph must introduce something new
- Skip setup statements framed as assumptions or simplifications unless the assumption
  itself is the core concept
- Give equal depth to each concept — do not rush later concepts because earlier
  ones took too long

Format rules:
- Start immediately with the first substantive concept — no intro sentence,
  no "in this lecture", no "today we"
- DIVE RIGHT INTO IT, NOT INTRO, NO FLUFF.
- No bullet points, no headers, no timestamps
- ABSOLUTELY NO TIMESTAMPS
- ABSOLUTELY NO LECTURE ID
- No filler phrases like "this is critical", "it's essential to understand",
  "this is important" — just explain the thing
- Do not conclude or summarize at the end — end on the last concept
- Write approximately 700 words — do not stop early
- If you are approaching the end, wrap up the current concept cleanly
  rather than cutting off mid-sentence
"""


def _load_config():
    """Load OCI config, remapping key_file to the current environment's ~/.oci/
    so it works both locally and inside Docker (where the host path differs)."""
    oci_dir = os.path.expanduser("~/.oci")
    config_file = os.path.join(oci_dir, "config")
    parser = configparser.ConfigParser()
    parser.read(config_file)
    cfg = dict(parser["DEFAULT"])
    
    # Remap key_file to use the current environment's oci_dir
    original_key_file = cfg.get("key_file", "")
    if original_key_file:
        key_filename = os.path.basename(original_key_file)
        remapped_path = os.path.join(oci_dir, key_filename)
        cfg["key_file"] = remapped_path
        # Verify the remapped path exists
        if not os.path.exists(remapped_path):
            raise FileNotFoundError(f"OCI key file not found at: {remapped_path}")
    
    return cfg


config = None
client = None


def _get_client():
    """Get or create the OCI client lazily."""
    global client
    if client is None:
        try:
            cfg = _load_config()
            print(f"[DEBUG] Loaded OCI config: key_file={cfg.get('key_file')}, region={cfg.get('region')}")
            # Don't validate yet - let the SDK validate when we actually use it
            client = generative_ai_agent_runtime.GenerativeAiAgentRuntimeClient(
                config=cfg,
                service_endpoint=SERVICE_EP,
            )
            print("[DEBUG] OCI client initialized successfully")
        except Exception as e:
            print(f"Failed to initialize OCI client: {e}")
            raise
    return client


def create_session(display_name: str) -> str:
    """Create a new OCI agent session and return its ID."""
    client = _get_client()
    resp = client.create_session(
        agent_endpoint_id=AGENT_ENDPOINT_ID,
        create_session_details=CreateSessionDetails(
            display_name=display_name,
            description="Created by Motus API",
        ),
    )
    return resp.data.id


def get_reply(prompt: str, oracle_session_id: str, course_id: str = "econ409") -> str:
    """Send a message to the agent and return its reply text.

    Filters the knowledge-base retrieval so only documents whose
    ``course`` metadata field matches *course_id* are considered.
    """
    client = _get_client()
    resp = client.chat(
        agent_endpoint_id=AGENT_ENDPOINT_ID,
        chat_details=ChatDetails(
            user_message=prompt,
            session_id=oracle_session_id,
            should_stream=False,
            tool_parameters={
                "rag": json.dumps({
                    "filterConditions": [
                        {
                            "field": "course",
                            "field_type": "string",
                            "operation": "contains",
                            "value": course_id
                            
                        }
                    ]
                })
            }
        ),
    )
    return resp.data.message.content.text


def generate_podcast(prompt: str, oracle_session_id: str, recording_id: str) -> str:
    """Generate a podcast summary for a specific lecture recording.

    Filters the knowledge-base retrieval so only documents whose
    ``recording_id`` metadata field matches *recording_id* are considered.
    """
    resp = client.chat(
        agent_endpoint_id=AGENT_ENDPOINT_ID,
        chat_details=ChatDetails(
            session_id=create_session(str(uuid.uuid4())),
            user_message=prompt,
            should_stream=False,
            tool_parameters={
                "rag": json.dumps({
                    "filterConditions": [
                        {
                            "field": "recording_id",
                            "field_type": "string",
                            "operation": "contains",
                            "value": recording_id
                        }
                    ]
                })
            }
        ),
    )
    return resp.data.message.content.text
