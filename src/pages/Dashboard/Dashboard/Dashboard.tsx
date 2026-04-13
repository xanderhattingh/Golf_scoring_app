import {useMemo} from 'react'
import {Outlet} from "react-router-dom";
import {UserContext} from "../../../Contexts/UserContext.ts";
import StorageService from "../../../services/StorageService.ts";
import Navigation from "../../../components/Navigation.tsx";

import "../../../styles/Components/navigation.scss"
import "../../../styles/Shared/backgrounds.scss"

const Dashboard = () => {
    const storage = new StorageService();
    const user = useMemo(() => storage.getUser(), []);


    console.log("dash loaded");
    return (
        <div className="dashboard-layout">
            <UserContext.Provider value={user}>
                <Navigation></Navigation>
                <div className="dashboard-content">
                    <Outlet></Outlet>
                </div>
            </UserContext.Provider>
        </div>
    )
}
export default Dashboard
