import {useContext} from 'react'
import {NavLink} from "react-router-dom";
import {UserContext} from "../Contexts/UserContext.ts";

const Navigation = () => {

    const user = useContext(UserContext)

    return (
        <>
            <div className="navigation-container">
                <div className="left">
                    {user.email}
                </div>
                <div className="right">
                    <NavLink to="/dashboard/courses">Courses</NavLink>
                    <NavLink to="/players">Players</NavLink>
                    <NavLink to="/rounds">Rounds</NavLink>
                </div>

            </div>
        </>
    )
}
export default Navigation
