import {Navigate, Outlet} from "react-router-dom";
import StorageService from "../services/StorageService.ts";

const Protected = () => {
    const storage = new StorageService();
    return storage.isLoggedIn() ? <Outlet/> : <Navigate to='/login'/>
}
export default Protected
