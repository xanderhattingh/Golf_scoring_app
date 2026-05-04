import {Route, Routes} from "react-router-dom";
import Login from "../pages/Auth/Login.tsx";
import Register from "../pages/Auth/Register.tsx";
import Protected from "./Protected.tsx";
import Courses from "../pages/Dashboard/Courses/Courses.tsx";
import Dashboard from "../pages/Dashboard/Dashboard/Dashboard.tsx";
import Friends from "../pages/Dashboard/Players/Players.tsx";
import Rounds from "../pages/Dashboard/Rounds/Rounds.tsx";
import RoundDetail from "../pages/Dashboard/Rounds/RoundDetail.tsx";
import Profile from "../pages/Dashboard/Profile/Profile.tsx";

const Routing = () => {
    return (
        <>
            <Routes>
                <Route path="/" element={<Login/>}/>
                <Route path="/login" element={<Login/>}/>
                <Route path="/register" element={<Register/>}/>
                <Route element={<Protected/>}>
                    {/*	Put the routes that you have to be logged in for in here */}
                    <Route path="/dashboard" element={<Dashboard/>}>
                        <Route path="/dashboard/courses" element={<Courses/>}></Route>
                        <Route path="/dashboard/friends" element={<Friends/>}></Route>
                        <Route path="/dashboard/rounds" element={<Rounds/>}></Route>
                        <Route path="/dashboard/profile" element={<Profile/>}></Route>
                    </Route>
                    <Route path="/round/:id" element={<RoundDetail/>}/>
                </Route>
            </Routes>
        </>
    )
}
export default Routing
