
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import CoursePage from './components/CoursePage';

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/course/:courseCode" element={<CoursePage />} />
        </Routes>
      </HashRouter>
    </div>
  );
}

export default App;
