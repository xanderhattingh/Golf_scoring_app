import "../styles/Components/add-course-modal.scss"
import InputGroup from "./InputGroup.tsx";
import {z} from "zod";
import {useEffect} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import HttpService from "../services/HttpService.ts";
import toast from "react-simple-toasts";
import 'react-simple-toasts/dist/style.css';

interface Player {
    id: number;
    name: string;
    surname: string;
    phone: string | null;
    handicap: number;
}

const player_schema = z.object({
    name: z.string().min(2).max(255),
    surname: z.string().min(2).max(255),
    phone: z.string().optional().or(z.literal("")),
    handicap: z.coerce.number().min(0).max(54).optional().default(0),
})

type PlayerFormData = z.infer<typeof player_schema>;

interface AddPlayerModalProps {
    mode?: 'add' | 'edit';
    player?: Player | null;
    onPlayerAdded?: (player: Player) => void;
    onPlayerUpdated?: (player: Player) => void;
    onCloseModal: () => void;
}

const AddPlayerModal = (props: AddPlayerModalProps) => {
    const {mode = 'add', player, onPlayerAdded, onPlayerUpdated, onCloseModal} = props

    const {
        register: player_form,
        formState: {isValid, errors},
        handleSubmit,
        reset
    } = useForm<PlayerFormData>({
        resolver: zodResolver(player_schema),
        defaultValues: mode === 'edit' && player ? {
            name: player.name,
            surname: player.surname,
            phone: player.phone || '',
            handicap: player.handicap
        } : {
            name: '',
            surname: '',
            phone: '',
            handicap: 0
        }
    })

    useEffect(() => {
        if (mode === 'edit' && player) {
            reset({
                name: player.name,
                surname: player.surname,
                phone: player.phone || '',
                handicap: player.handicap
            })
        }
    }, [mode, player?.id, reset])

    const onSubmitPlayer = async (values: PlayerFormData) => {
        try {
            const httpService = new HttpService();
            
            if (mode === 'edit' && player) {
                const response = await httpService.put(`players/${player.id}`, {
                    name: values.name,
                    surname: values.surname,
                    phone: values.phone || null,
                    handicap: values.handicap
                });
                
                if (response.data?.success) {
                    onPlayerUpdated?.(response.data.data);
                } else {
                    toast(response.data?.message || 'Update failed', {theme: 'failure', duration: 3000});
                }
            } else {
                const response = await httpService.post("players", {
                    name: values.name,
                    surname: values.surname,
                    phone: values.phone || null,
                    handicap: values.handicap
                });
                
                if (response.data?.success) {
                    onPlayerAdded?.(response.data.data);
                } else {
                    toast(response.data?.message || 'Creation failed', {theme: 'failure', duration: 3000});
                }
            }
        } catch (error: any) {
            console.error("Player save error:", error);
            const message = error.response?.data?.message 
                || error.response?.data?.errors?.phone?.[0]
                || 'Something has gone wrong';
            toast(message, {theme: 'failure', duration: 3000});
        }
    }

    return (
        <>
            <div className="modal-container">
                <div className="modal-content">
                    <div className="modal-header">
                        <div className="header">{mode === 'edit' ? 'Edit Player' : 'Add New Player'}</div>
                        <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                    </div>
                    <form className="add-course-form" onSubmit={handleSubmit(onSubmitPlayer)}>
                        <InputGroup
                            label_value="First Name"
                            {...player_form("name")}
                            placeholder="Enter first name"
                            type="text"
                        />
                        {errors.name && <span className="error-text">{errors.name.message}</span>}
                        
                        <InputGroup
                            label_value="Surname"
                            {...player_form("surname")}
                            placeholder="Enter surname"
                            type="text"
                        />
                        {errors.surname && <span className="error-text">{errors.surname.message}</span>}
                        
                        <InputGroup
                            label_value="Phone (optional - player can add later)"
                            {...player_form("phone")}
                            placeholder="Enter phone number (optional)"
                            type="tel"
                        />
                        
                        <InputGroup
                            label_value="Handicap"
                            {...player_form("handicap")}
                            placeholder="Handicap"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="54"
                        />
                        {errors.handicap && <span className="error-text">Handicap must be 0-54</span>}
                        
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
