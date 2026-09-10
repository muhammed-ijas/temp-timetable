import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { VP_PASSWORD } from './lib/supabase'
import VPHome from './pages/vp/VPHome'
import VPTimetable from './pages/vp timetable/VPTimetable'
import VPSubjects from './pages/vp/VPSubjects'

// Draft timetable site — no login. The pages expect the VP session
// to exist, so it's set here on load.
sessionStorage.setItem('pgs_vp', VP_PASSWORD)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/vp" element={<VPHome />} />
        <Route path="/vp/timetable" element={<VPTimetable />} />
        <Route path="/vp/subjects" element={<VPSubjects />} />
        <Route path="*" element={<Navigate to="/vp" replace />} />
      </Routes>
    </BrowserRouter>
  )
}