import {useContext, useState} from 'react'

import './App.css'
import Routing from "./routes/Routing.tsx";


function App() {

    return (
        <div className="app">
            <Routing></Routing>
        </div>
    )
}

export default App
