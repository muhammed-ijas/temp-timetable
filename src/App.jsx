import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherDiary from './pages/TeacherDiary'
import MarksEntry from './pages/MarksEntry'
import MyClassTimetable from './pages/MyClassTimetable'
// import Admin from './pages/Admin'
import VPHome from './pages/vp/VPHome'
import VPLeaves from './pages/vp/VPLeaves'
import VPLates from './pages/vp/VPLates'
import VPHolidays from './pages/vp/VPHolidays'
import VPSpecial from './pages/vp/VPSpecial'
import VPTeachers from './pages/vp/VPTeachers'

import VPMarks from './pages/vpmarks/VPMarks'
import VPSubjects from './pages/vp/VPSubjects'

import ManageStudents from './pages/ManageStudents'
import MarksSheet from './pages/MarksSheet'

import VPTimetable from './pages/vp timetable/VPTimetable'
import VPReportCards from './pages/vp/VPReportCards'

import TeacherTimetable from './pages/TeacherTimetable'
import LeaveHistory from './pages/LeaveHistory'

import VPDiary from './pages/vpteachersdiary/VPDiary'

import HRHome from './pages/hr/HRHome'
import HRLeaves from './pages/hr/HRLeaves'
import HRHolidays from './pages/hr/HRHolidays'
import HRSpecial from './pages/hr/HRSpecial'
import HRTeachers from './pages/hr/HRTeachers'
import HRBalances from './pages/hr/HRBalances'






export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<TeacherDashboard />} />
        <Route path="/timetable" element={<TeacherTimetable />} />
        <Route path="/history" element={<LeaveHistory />} />
        <Route path="/diary" element={<TeacherDiary />} />
        

        <Route path="/students" element={<ManageStudents />} />
        <Route path="/marks" element={<MarksEntry />} />
        <Route path="/marks/sheet" element={<MarksSheet />} />
        <Route path="/my-class" element={<MyClassTimetable />} />

        {/* <Route path="/admin" element={<Admin />} /> */}
        <Route path="/admin" element={<HRHome />} />
        <Route path="/admin/leaves" element={<HRLeaves />} />
        <Route path="/admin/holidays" element={<HRHolidays />} />
        <Route path="/admin/special" element={<HRSpecial />} />
        <Route path="/admin/teachers" element={<HRTeachers />} />
        <Route path="/admin/balances" element={<HRBalances />} />


        <Route path="/vp" element={<VPHome />} />
        <Route path="/vp/leaves" element={<VPLeaves />} />
        <Route path="/vp/lates" element={<VPLates />} />
        <Route path="/vp/holidays" element={<VPHolidays />} />
        <Route path="/vp/special" element={<VPSpecial />} />
        <Route path="/vp/teachers" element={<VPTeachers />} />
        <Route path="/vp/timetable" element={<VPTimetable />} />
        <Route path="/vp/diary" element={<VPDiary />} />
        <Route path="/vp/marks" element={<VPMarks />} />
        <Route path="/vp/marks/sheet" element={<MarksSheet />} />
        <Route path="/vp/report-cards" element={<VPReportCards />} />
        <Route path="/vp/subjects" element={<VPSubjects />} />

      </Routes>
    </BrowserRouter>
  )
}