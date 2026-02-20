import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
import CourseTutorMVP from "./components/CourseTutorMVP";
import ProfessorPage from "./components/ProfessorPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<CourseTutorMVP />} />
        <Route path="/professor" element={<ProfessorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
