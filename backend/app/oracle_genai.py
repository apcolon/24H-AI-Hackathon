import os
import configparser
import oci
from oci import generative_ai_agent_runtime
from oci.generative_ai_agent_runtime.models import CreateSessionDetails, ChatDetails

SERVICE_EP = "https://agent-runtime.generativeai.us-ashburn-1.oci.oraclecloud.com"
AGENT_ENDPOINT_ID = "ocid1.genaiagentendpoint.oc1.iad.amaaaaaampxat2aav2cs2xnw6s42i5efbzfmrlyrb6oyeljwmce2blidv5bq"


def _load_config():
    """Load OCI config, remapping key_file to the current environment's ~/.oci/
    so it works both locally and inside Docker (where the host path differs)."""
    oci_dir = os.path.expanduser("~/.oci")
    parser = configparser.ConfigParser()
    parser.read(os.path.join(oci_dir, "config"))
    cfg = dict(parser["DEFAULT"])
    cfg["key_file"] = os.path.join(oci_dir, os.path.basename(cfg["key_file"]))
    oci.config.validate_config(cfg)
    return cfg


config = _load_config()

client = generative_ai_agent_runtime.GenerativeAiAgentRuntimeClient(
    config=config,
    service_endpoint=SERVICE_EP,
)


def create_session(display_name: str) -> str:
    """Create a new OCI agent session and return its ID."""
    resp = client.create_session(
        agent_endpoint_id=AGENT_ENDPOINT_ID,
        create_session_details=CreateSessionDetails(
            display_name=display_name,
            description="Created by CourseTutor API",
        ),
    )
    return resp.data.id


def get_reply(prompt: str, oracle_session_id: str) -> str:
    """Send a message to the agent and return its reply text."""
    resp = client.chat(
        agent_endpoint_id=AGENT_ENDPOINT_ID,
        chat_details=ChatDetails(
            user_message=prompt,
            session_id=oracle_session_id,
            should_stream=False,
        ),
    )
    return resp.data.message.content.text
