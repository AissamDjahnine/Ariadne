import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white text-gray-900 font-sans">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/read" element={<Reader />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;