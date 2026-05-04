import {NavLink} from "react-router-dom";

const Navigation = () => {


    return (
        <>
            <div className="navigation-container">
                <div className="left">
                </div>
                <div className="right">
                    <NavLink to="/dashboard/courses">Courses</NavLink>
                    <NavLink to="/dashboard/friends">Friends</NavLink>
                    <NavLink to="/dashboard/rounds">Rounds</NavLink>
                    <NavLink to="/dashboard/profile">Profile</NavLink>
                </div>

            </div>
        </>
    )
}
export default Navigation
