import {useState} from 'react'
import {Outlet} from "react-router-dom";
import {UserContext} from "../../../Contexts/UserContext.ts";
import StorageService from "../../../services/StorageService.ts";
import Navigation from "../../../components/Navigation.tsx";

import "../../../styles/Components/navigation.scss"

const Dashboard = () => {
    const storage = new StorageService();
    const ls = JSON.parse(storage.get())?.user;
    const [user] = useState(ls);


    console.log("dash loaded");
    return (
        <div>
            <UserContext.Provider value={user}>
                <Navigation></Navigation>
                <Outlet></Outlet>
            </UserContext.Provider>
        </div>
    )
}
export default Dashboard
