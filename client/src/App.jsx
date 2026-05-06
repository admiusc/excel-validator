import { Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './pages/UploadPage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
