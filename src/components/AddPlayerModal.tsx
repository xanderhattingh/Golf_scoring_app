import "../styles/Components/add-course-modal.scss"
import InputGroup from "./InputGroup.tsx";
import {z} from "zod";
import {useEffect} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import LocalDataService from "../services/LocalDataService.ts";
import toast from "react-simple-toasts";
import 'react-simple-toasts/dist/style.css';
import 'react-simple-toasts/dist/theme/failure.css';

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

    const onSubmitPlayer = (values) => {
        const dataService = new LocalDataService();

        try {
            if (mode === 'edit') {
                const updatedPlayer = dataService.updatePlayer({
                    player_id: player.id,
                    name: values.name,
                    handicap: values.handicap
                });
                onPlayerUpdated(updatedPlayer);
            } else {
                const newPlayer = dataService.addPlayer({
                    name: values.name,
                    handicap: values.handicap
                });
                onPlayerAdded(newPlayer);
            }
        } catch (error: any) {
            if (error.status === 422) {
                toast('Player already exists', {theme: 'failure', duration: 3000});
            } else {
                toast('Something has gone wrong', {theme: 'failure', duration: 3000});
            }
        }
    }

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
                            inputMode="numeric"
                            pattern="[0-9]*"
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
export default AddPlayerModal
