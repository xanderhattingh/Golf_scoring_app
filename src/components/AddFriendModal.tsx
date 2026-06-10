import "../styles/Components/add-course-modal.scss"
import InputGroup from "./InputGroup.tsx";
import {z} from "zod";
import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import HttpService from "../services/HttpService.ts";
import toast from "react-simple-toasts";
import 'react-simple-toasts/dist/style.css';

interface SearchResult {
    id: number;
    name: string;
    surname: string;
    phone: string | null;
    handicap: number;
    email: string | null;
}

const playerSchema = z.object({
    name: z.string().min(2).max(255),
    surname: z.string().min(2).max(255),
    phone: z.string(),
    handicap: z.string().refine((val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0 && num <= 54;
    }, { message: 'Handicap must be between 0 and 54' }),
})

type PlayerFormData = z.infer<typeof playerSchema>;

interface AddFriendModalProps {
    onFriendAdded: (friend: any) => void;
    onCloseModal: () => void;
}

const AddFriendModal = (props: AddFriendModalProps) => {
    const { onFriendAdded, onCloseModal } = props;

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isValid },
        reset,
    } = useForm<PlayerFormData>({
        resolver: zodResolver(playerSchema),
        defaultValues: {
            name: '',
            surname: '',
            phone: '',
            handicap: '0',
        }
    })

    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const httpService = new HttpService();
                const response = await httpService.get(`players/search?q=${encodeURIComponent(searchQuery)}`);
                setSearchResults(response.data?.data || []);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectResult = (result: SearchResult) => {
        setSelectedPlayer(result);
        setSearchQuery('');
        setSearchResults([]);
        reset({
            name: result.name,
            surname: result.surname,
            phone: result.phone || '',
            handicap: String(result.handicap),
        });
    };

    const handleClearSelection = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedPlayer(null);
        setSearchResults([]);
        reset({
            name: '',
            surname: '',
            phone: '',
            handicap: '0',
        });
    };

    const onSubmit = async (data: PlayerFormData) => {
        setIsSaving(true);
        try {
            const httpService = new HttpService();

            if (selectedPlayer) {
                const response = await httpService.post('friends', {
                    friend_id: selectedPlayer.id,
                });
                if (response.data?.success) {
                    onFriendAdded(response.data.data);
                    toast('Friend added successfully', { className: 'success-toast' });
                } else {
                    toast(response.data?.message || 'Failed to add friend', { className: 'error-toast' });
                }
            } else {
                const response = await httpService.post('players', {
                    name: data.name,
                    surname: data.surname,
                    phone: data.phone || null,
                    handicap: Number(data.handicap),
                });
                if (response.data?.success) {
                    onFriendAdded(response.data.data);
                    toast('Friend created successfully', { className: 'success-toast' });
                } else {
                    toast(response.data?.message || 'Failed to create friend', { className: 'error-toast' });
                }
            }
        } catch (error: any) {
            console.error('Save error:', error);
            const message = error.response?.data?.message
                || error.response?.data?.errors?.phone?.[0]
                || 'Something went wrong';
            toast(message, { className: 'error-toast' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-container">
            <div className="modal-content">
                <div className="modal-header">
                    <div className="header">Add Friend</div>
                    <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                </div>
                <form className="add-course-form" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                    <div className="input-group">
                        <label className="input-label">Search existing players</label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Type a name or phone number..."
                            autoComplete="off"
                        />
                        {isSearching && <span className="searching-indicator">Searching...</span>}
                    </div>

                    {searchResults.length > 0 && (
                        <div className="search-results">
                            {searchResults.map((result) => (
                                <div
                                    key={result.id}
                                    className="search-result-item"
                                    onClick={() => handleSelectResult(result)}
                                >
                                    <div className="result-info">
                                        <span className="result-name">{result.name} {result.surname}</span>
                                        {result.phone && <span className="result-phone">{result.phone}</span>}
                                    </div>
                                    <span className="handicap-badge">{result.handicap}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedPlayer && (
                        <div className="selected-player-banner">
                            <span>Selected: <strong>{selectedPlayer.name} {selectedPlayer.surname}</strong></span>
                            <button type="button" className="clear-selection" onClick={handleClearSelection}>
                                Change
                            </button>
                        </div>
                    )}

                    <InputGroup
                        label_value="First Name"
                        {...register("name")}
                        placeholder="Enter first name"
                        type="text"
                        disabled={!!selectedPlayer}
                    />
                    {errors.name && <span className="error-text">{errors.name.message}</span>}

                    <InputGroup
                        label_value="Surname"
                        {...register("surname")}
                        placeholder="Enter surname"
                        type="text"
                        disabled={!!selectedPlayer}
                    />
                    {errors.surname && <span className="error-text">{errors.surname.message}</span>}

                    <InputGroup
                        label_value="Phone"
                        {...register("phone")}
                        placeholder="Enter phone number"
                        type="tel"
                        disabled={!!selectedPlayer}
                    />

                    <InputGroup
                        label_value="Handicap"
                        {...register("handicap")}
                        placeholder="Handicap"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="54"
                        disabled={!!selectedPlayer}
                    />
                    {errors.handicap && <span className="error-text">Handicap must be 0-54</span>}

                    <button type="submit" className="button-primary" disabled={!isValid || isSaving}>
                        {isSaving ? 'Saving...' : (selectedPlayer ? 'Add Friend' : 'Create Friend')}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default AddFriendModal;
