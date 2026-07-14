import {Route, Routes} from "react-router-dom";
import Login from "../pages/Auth/Login.tsx";
import Register from "../pages/Auth/Register.tsx";
import ForgotPassword from "../pages/Auth/ForgotPassword.tsx";
import ResetPassword from "../pages/Auth/ResetPassword.tsx";
import DeepLinkListener from "../components/DeepLinkListener.tsx";
import Protected from "./Protected.tsx";
import Courses from "../pages/Dashboard/Courses/Courses.tsx";
import Dashboard from "../pages/Dashboard/Dashboard.tsx";
import Friends from "../pages/Dashboard/Players/Players.tsx";
import Rounds from "../pages/Dashboard/Rounds/Rounds.tsx";
import RoundDetail from "../pages/Dashboard/Rounds/RoundDetail.tsx";
import Profile from "../pages/Dashboard/Profile/Profile.tsx";
import Tournament from "../pages/Dashboard/Tournament/Tournament.tsx";

const Routing = () => {
    return (
        <>
            <DeepLinkListener/>
            <Routes>
                <Route path="/" element={<Login/>}/>
                <Route path="/login" element={<Login/>}/>
                <Route path="/register" element={<Register/>}/>
                <Route path="/forgot-password" element={<ForgotPassword/>}/>
                <Route path="/reset-password" element={<ResetPassword/>}/>
                <Route element={<Protected/>}>
                    {/*	Put the routes that you have to be logged in for in here */}
                    <Route path="/dashboard" element={<Dashboard/>}>
                        <Route path="/dashboard/courses" element={<Courses/>}></Route>
                        <Route path="/dashboard/friends" element={<Friends/>}></Route>
                        <Route path="/dashboard/rounds" element={<Rounds/>}></Route>
                        <Route path="/dashboard/profile" element={<Profile/>}></Route>
                        <Route path="/dashboard/tournament" element={<Tournament/>}></Route>
                    </Route>
                    <Route path="/round/:id" element={<RoundDetail/>}/>
                </Route>
            </Routes>
        </>
    )
}
export default Routing
