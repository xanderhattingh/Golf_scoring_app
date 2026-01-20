import {Route, Routes} from "react-router-dom";
import Login from "../pages/Auth/Login.tsx";
import Register from "../pages/Auth/Register.tsx";
import Protected from "./Protected.tsx";
import Courses from "../pages/Dashboard/Courses/Courses.tsx";
import Dashboard from "../pages/Dashboard/Dashboard/Dashboard.tsx";
import Players from "../pages/Dashboard/Players/Players.tsx";

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
                        <Route path="/dashboard/players" element={<Players/>}></Route>
                    </Route>
                </Route>
            </Routes>
        </>
    )
}
export default Routing
