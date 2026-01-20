import "../styles/Components/add-course-modal.scss"
import InputGroup from "./InputGroup.tsx";
import {z} from "zod";
import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import HttpService from "../services/HttpService.ts";
import {HashLoader} from "react-spinners";
import toast from "react-simple-toasts";

const player_schema = z.object({
    name: z.string().min(2).max(255),
    handicap: z.number().min(0).max(54),
})

const AddPlayerModal = (props) => {
    const {onPlayerAdded, onCloseModal} = props

    const {
        register: player_form,
        formState: {isValid},
        handleSubmit
    } = useForm({resolver: zodResolver(player_schema)})

    const [loading, setLoading] = useState(false);

    const onCreatePlayer = async (values) => {
        setLoading(true);
        const apiService = new HttpService();
        const {request, cancel} = await apiService.post('/add_player', values);

        request.then(
            (response) => {
                setLoading(false);
                onPlayerAdded(response?.data)

            },
            (error) => {
                if (error.status === 422) {
                    setLoading(false);
                    toast('Player already exists', {theme: 'failure', duration: 3000});
                } else {
                    setLoading(false);
                    toast('Something has gone wrong', {theme: 'failure', duration: 3000});
                }

            }
        ).catch(() => {
            console.log("catch");
            setLoading(false);
            toast('Something has gone wrong', {theme: 'failure', duration: 3000});
        })


        return () => {
            // Cleanup logic: if the component unmounts before the request completes, cancel the request
            cancel("Component unmounted, aborting request");
        };
    }

    if (loading) {
        return (
            <div className="login-container">
                <HashLoader color={"#155DFC"}/>
            </div>
        )
    } else {
        return (
            <>
                <div className="modal-container">
                    <div className="modal-content">
                        <div className="header">Player Details</div>
                        <form className="add-course-form" onSubmit={handleSubmit(onCreatePlayer)}>
                            <InputGroup
                                label_value="Player Name"
                                {...player_form("name")}
                                placeholder="Player name"
                                type="text"
                            ></InputGroup>
                            <InputGroup
                                label_value="Handicap"
                                {...player_form("handicap", {valueAsNumber: true})}
                                placeholder="Handicap"
                                type="number"
                            ></InputGroup>
                            <button type={'submit'} className="button-primary" disabled={!isValid}>Create Player
                            </button>
                        </form>
                    </div>
                </div>

            </>
        )
    }


}
export default AddPlayerModal
