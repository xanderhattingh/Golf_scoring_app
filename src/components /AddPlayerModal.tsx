import "../styles/Components/add-course-modal.scss"
import InputGroup from "./InputGroup.tsx";
import {z} from "zod";
import {useEffect, useState} from "react";
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
    const {mode = 'add', player, onPlayerAdded, onPlayerUpdated, onCloseModal} = props

    const {
        register: player_form,
        formState: {isValid},
        handleSubmit,
        reset
    } = useForm({
        resolver: zodResolver(player_schema),
        defaultValues: mode === 'edit' && player ? {
            name: player.name,
            handicap: player.handicap
        } : undefined
    })

    useEffect(() => {
        if (mode === 'edit' && player) {
            reset({
                name: player.name,
                handicap: player.handicap
            })
        }
    }, [mode, player, reset])

    const [loading, setLoading] = useState(false);

    const onSubmitPlayer = async (values) => {
        setLoading(true);
        const apiService = new HttpService();

        const endpoint = mode === 'edit' ? '/edit_player' : '/add_player';
        const payload = mode === 'edit' ? {...values, player_id: player.id} : values;

        const {request, cancel} = await apiService.post(endpoint, payload);

        request.then(
            (response) => {
                setLoading(false);
                if (mode === 'edit') {
                    onPlayerUpdated(response?.data)
                } else {
                    onPlayerAdded(response?.data)
                }

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
                        <div className="modal-header">
                            <div className="header">{mode === 'edit' ? 'Edit Player' : 'Player Details'}</div>
                            <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                        </div>
                        <form className="add-course-form" onSubmit={handleSubmit(onSubmitPlayer)}>
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
                            <button type={'submit'} className="button-primary" disabled={!isValid}>
                                {mode === 'edit' ? 'Update Player' : 'Create Player'}
                            </button>
                        </form>
                    </div>
                </div>

            </>
        )
    }


}
export default AddPlayerModal
