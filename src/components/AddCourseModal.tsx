import "../styles/Components/add-course-modal.scss"
import InputGroup from "./InputGroup.tsx";
import {z} from "zod";
import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import HttpService from "../services/HttpService.ts";
import toast from "react-simple-toasts";
import 'react-simple-toasts/dist/style.css';

interface Tee {
    id: number;
    name: string;
    description: string;
    colour_code: string;
}

interface Hole {
    hole_number: number;
    par: number;
    stroke_index: number;
}


const courseSchema = z.object({
    name: z.string().min(2).max(255),
    location: z.string().optional(),
});

type CourseFormData = z.infer<typeof courseSchema>;

interface AddCourseModalProps {
    mode?: 'add' | 'edit';
    course?: any;
    onCourseAdded?: (course: any) => void;
    onCourseUpdated?: (course: any) => void;
    onCloseModal: () => void;
}

const AddCourseModal = ({
                            mode = 'add',
                            course,
                            onCourseAdded,
                            onCourseUpdated,
                            onCloseModal
                        }: AddCourseModalProps) => {
    const [tees, setTees] = useState<Tee[]>([]);
    const [selectedTees, setSelectedTees] = useState<number[]>([]);
    const [activeTeeId, setActiveTeeId] = useState<number | null>(null);
    const [holesData, setHolesData] = useState<Record<number, Hole[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [existingTeeIds, setExistingTeeIds] = useState<number[]>([]);
    const [bulkParInput, setBulkParInput] = useState('');
    const [bulkStrokeInput, setBulkStrokeInput] = useState('');
    const [bulkError, setBulkError] = useState('');

    const {
        register,
        handleSubmit,
        formState: {errors, isValid},
    } = useForm<CourseFormData>({
        resolver: zodResolver(courseSchema),
        defaultValues: {
            name: course?.name || '',
            location: course?.location || '',
        }
    });

    // Fetch tees on mount
    useEffect(() => {
        fetchTees();
    }, []);

    // Initialize from existing course data in edit mode
    useEffect(() => {
        if (mode === 'edit' && course?.tees) {
            const existingIds = course.tees.map((t: any) => t.tee_id);
            setExistingTeeIds(existingIds);
            setSelectedTees(existingIds);

            // Initialize holes data from existing course
            const existingHoles: Record<number, Hole[]> = {};
            course.tees.forEach((tee: any) => {
                existingHoles[tee.tee_id] = tee.holes.map((h: any) => ({
                    hole_number: h.hole_number,
                    par: h.par,
                    stroke_index: h.stroke_index,
                }));
            });
            setHolesData(existingHoles);

            if (existingIds.length > 0) {
                setActiveTeeId(existingIds[0]);
            }
        }
    }, [mode, course]);

    // Initialize holes for newly selected tees
    useEffect(() => {
        selectedTees.forEach(teeId => {
            if (!holesData[teeId]) {
                const initialHoles: Hole[] = [];
                for (let i = 1; i <= 18; i++) {
                    initialHoles.push({
                        hole_number: i,
                        par: 4,
                        stroke_index: i,
                    });
                }
                setHolesData(prev => ({...prev, [teeId]: initialHoles}));
            }
        });
    }, [selectedTees]);

    const fetchTees = async () => {
        setIsLoading(true);
        try {
            const httpService = new HttpService();
            const response = await httpService.get("courses/tees");
            setTees(response.data.data || []);
        } catch (error) {
            console.error("Error fetching tees:", error);
            toast("Failed to load tees", {className: "error-toast"});
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTee = (teeId: number) => {
        if (selectedTees.includes(teeId)) {
            // Don't allow removing existing tees in edit mode (would lose data)
            if (mode === 'edit' && existingTeeIds.includes(teeId)) {
                toast("Cannot remove existing tee data. Delete the course and recreate if needed.", {className: "error-toast"});
                return;
            }
            setSelectedTees(prev => prev.filter(id => id !== teeId));
            if (activeTeeId === teeId) {
                setActiveTeeId(null);
            }
        } else {
            setSelectedTees(prev => [...prev, teeId]);
            setActiveTeeId(teeId);
        }
    };

    const updateHole = (teeId: number, holeIndex: number, field: keyof Hole, value: number) => {
        setHolesData(prev => ({
            ...prev,
            [teeId]: prev[teeId].map((hole, idx) =>
                idx === holeIndex ? {...hole, [field]: value} : hole
            )
        }));
    };

    const getTeeById = (id: number) => tees.find(t => t.id === id);

    const parseBulkInput = (input: string, type: 'par' | 'stroke'): number[] | null => {
        // Try comma-separated first
        let values = input.split(',').map(v => v.trim()).filter(v => v !== '');
        
        // If no commas, try space-separated
        if (values.length === 1) {
            values = input.split(/\s+/).map(v => v.trim()).filter(v => v !== '');
        }
        
        if (values.length === 0) return null;
        
        const numbers: number[] = [];
        for (const val of values) {
            const num = parseInt(val, 10);
            if (isNaN(num)) {
                setBulkError(`Invalid ${type} value: "${val}"`);
                return null;
            }
            // Validate ranges
            if (type === 'par' && (num < 3 || num > 5)) {
                setBulkError(`Par must be 3, 4, or 5. Got: ${num}`);
                return null;
            }
            if (type === 'stroke' && (num < 1 || num > 18)) {
                setBulkError(`Stroke index must be 1-18. Got: ${num}`);
                return null;
            }
            numbers.push(num);
        }
        
        return numbers;
    };

    const applyBulkPar = () => {
        setBulkError('');
        
        if (!activeTeeId || !bulkParInput) return;
        
        const parValues = parseBulkInput(bulkParInput, 'par');
        if (parValues === null) return;
        
        if (parValues.length !== 18) {
            setBulkError(`Expected 18 par values, got ${parValues.length}`);
            return;
        }
        
        setHolesData(prev => ({
            ...prev,
            [activeTeeId]: prev[activeTeeId].map((hole, index) => ({
                ...hole,
                par: parValues[index],
            }))
        }));
        
        setBulkParInput('');
        toast("Par values applied!", { className: "success-toast" });
    };

    const applyBulkStroke = () => {
        setBulkError('');
        
        if (!activeTeeId || !bulkStrokeInput) return;
        
        const strokeValues = parseBulkInput(bulkStrokeInput, 'stroke');
        if (strokeValues === null) return;
        
        if (strokeValues.length !== 18) {
            setBulkError(`Expected 18 stroke index values, got ${strokeValues.length}`);
            return;
        }
        
        setHolesData(prev => ({
            ...prev,
            [activeTeeId]: prev[activeTeeId].map((hole, index) => ({
                ...hole,
                stroke_index: strokeValues[index],
            }))
        }));
        
        setBulkStrokeInput('');
        toast("Stroke indices applied!", { className: "success-toast" });
    };

    const getDuplicateStrokeIndices = (teeId: number): number[] => {
        const holes = holesData[teeId];
        if (!holes) return [];

        const strokeIndices = holes.map(h => h.stroke_index);
        const duplicates: number[] = [];
        const seen = new Set<number>();

        for (const index of strokeIndices) {
            if (seen.has(index)) {
                duplicates.push(index);
            } else {
                seen.add(index);
            }
        }
        return [...new Set(duplicates)];
    };

    const validateStrokeIndices = (): { valid: boolean; message: string } => {
        for (const teeId of selectedTees) {
            const holes = holesData[teeId];
            if (!holes) continue;

            const strokeIndices = holes.map(h => h.stroke_index);
            const duplicates: number[] = [];
            const seen = new Set<number>();

            for (const index of strokeIndices) {
                if (seen.has(index)) {
                    duplicates.push(index);
                } else {
                    seen.add(index);
                }
            }

            if (duplicates.length > 0) {
                const tee = getTeeById(teeId);
                const uniqueDuplicates = [...new Set(duplicates)];
                return {
                    valid: false,
                    message: `${tee?.name} tees: Stroke index ${uniqueDuplicates.join(', ')} is used multiple times. Each hole must have a unique stroke index (1-18).`
                };
            }
        }
        return {valid: true, message: ''};
    };

    const onSubmit = async (data: CourseFormData) => {
        if (selectedTees.length === 0) {
            toast("Please select at least one tee", {className: "error-toast"});
            return;
        }

        // Validate stroke indices are unique
        const validation = validateStrokeIndices();
        if (!validation.valid) {
            toast(validation.message, {className: "error-toast"});
            return;
        }

        setIsSaving(true);
        try {
            const httpService = new HttpService();

            if (mode === 'edit' && course) {
                // Update course name/location
                await httpService.put(`courses/${course.id}`, {
                    name: data.name,
                    location: data.location,
                });

                // Add new tees that don't exist yet
                const newTeeIds = selectedTees.filter(id => !existingTeeIds.includes(id));

                for (const teeId of newTeeIds) {
                    await httpService.post(`courses/${course.id}/tees`, {
                        tee_id: teeId,
                        holes: holesData[teeId] || [],
                    });
                }

                // Fetch updated course data
                const updatedResponse = await httpService.get(`courses`);
                const updatedCourse = updatedResponse.data.data.find((c: any) => c.id === course.id);

                onCourseUpdated?.(updatedCourse || {...course, name: data.name, location: data.location});
            } else {
                // Create new course
                const teesPayload = selectedTees.map(teeId => ({
                    tee_id: teeId,
                    holes: holesData[teeId] || []
                }));

                const response = await httpService.post("courses", {
                    name: data.name,
                    location: data.location,
                    num_holes: 18,
                    tees: teesPayload,
                });

                if (response.data?.success) {
                    // Fetch full course data with tees
                    const coursesResponse = await httpService.get("courses");
                    const newCourse = coursesResponse.data.data.find((c: any) => c.id === response.data.data.id);
                    onCourseAdded?.(newCourse || response.data.data);
                } else {
                    toast(response.data?.message || "Failed to create course", {className: "error-toast"});
                }
            }

            onCloseModal();
        } catch (error: any) {
            console.error("Error saving course:", error);
            toast(error.response?.data?.message || "Failed to save course", {className: "error-toast"});
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="modal-container">
                <div className="modal-content">
                    <div className="loading-state">Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-container">
            <div className="modal-content wide">
                <div className="modal-header">
                    <div className="header">{mode === 'edit' ? 'Edit Course' : 'Add New Course'}</div>
                    <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                </div>

                <form className="add-course-form" onSubmit={handleSubmit(onSubmit)}>
                    {/* Course Info */}
                    <div className="course-info-section">
                        <InputGroup
                            label_value="Course Name *"
                            {...register("name")}
                            placeholder="Enter course name"
                            type="text"
                        />
                        {errors.name && <span className="error-text">{errors.name.message}</span>}

                        <InputGroup
                            label_value="Location (optional)"
                            {...register("location")}
                            placeholder="Enter course location"
                            type="text"
                        />
                    </div>

                    {/* Tee Selection */}
                    <div className="tee-selection-section">
                        <label className="section-label">Select Tees *</label>
                        <div className="tee-chips">
                            {tees.map(tee => (
                                <button
                                    key={tee.id}
                                    type="button"
                                    className={`tee-chip ${selectedTees.includes(tee.id) ? 'selected' : ''} ${existingTeeIds.includes(tee.id) ? 'existing' : ''}`}
                                    style={{
                                        '--tee-color': tee.colour_code || '#ccc',
                                    } as React.CSSProperties}
                                    onClick={() => toggleTee(tee.id)}
                                >
                                    <span
                                        className="tee-dot"
                                        style={{backgroundColor: tee.colour_code}}
                                    />
                                    {tee.name} - {tee.description}
                                    {existingTeeIds.includes(tee.id) && <span className="existing-badge">✓</span>}
                                </button>
                            ))}
                        </div>
                        {selectedTees.length === 0 && (
                            <span className="error-text">Please select at least one tee</span>
                        )}
                    </div>

                    {/* Tee Tabs */}
                    {selectedTees.length > 0 && (
                        <div className="tee-tabs-section">
                            <div className="tee-tabs">
                                {selectedTees.map(teeId => {
                                    const tee = getTeeById(teeId);
                                    if (!tee) return null;
                                    const isExisting = existingTeeIds.includes(teeId);
                                    return (
                                        <button
                                            key={teeId}
                                            type="button"
                                            className={`tee-tab ${activeTeeId === teeId ? 'active' : ''} ${isExisting ? 'existing' : ''}`}
                                            style={activeTeeId === teeId ? {borderColor: tee.colour_code} : undefined}
                                            onClick={() => setActiveTeeId(teeId)}
                                        >
                                            <span
                                                className="tee-dot"
                                                style={{backgroundColor: tee.colour_code}}
                                            />
                                            {tee.name}
                                            {isExisting && <span className="existing-indicator">✓</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Bulk Input Section */}
                            {activeTeeId && holesData[activeTeeId] && (
                                <div className="bulk-input-section">
                                    <div className="bulk-input-header">
                                        Quick Entry: Paste 18 values (comma or space separated)
                                    </div>
                                    {bulkError && <div className="bulk-error">{bulkError}</div>}
                                    <div className="bulk-input-row">
                                        <input
                                            type="text"
                                            className="bulk-input"
                                            placeholder="Pars: 4,4,3,4,5... (or 4 4 3 4 5...)"
                                            value={bulkParInput}
                                            onChange={(e) => setBulkParInput(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="bulk-apply-btn"
                                            onClick={applyBulkPar}
                                            disabled={!bulkParInput}
                                        >
                                            Apply Par
                                        </button>
                                    </div>
                                    <div className="bulk-input-row">
                                        <input
                                            type="text"
                                            className="bulk-input"
                                            placeholder="Strokes: 1,2,3,4,5... (or 1 2 3 4 5...)"
                                            value={bulkStrokeInput}
                                            onChange={(e) => setBulkStrokeInput(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="bulk-apply-btn"
                                            onClick={applyBulkStroke}
                                            disabled={!bulkStrokeInput}
                                        >
                                            Apply Stroke
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Holes Entry for Active Tee */}
                            {activeTeeId && holesData[activeTeeId] && (
                                <div className="holes-section">
                                    {(() => {
                                        const duplicates = getDuplicateStrokeIndices(activeTeeId);
                                        return duplicates.length > 0 ? (
                                            <div className="duplicates-warning">
                                                ⚠️ Duplicate stroke indices: {duplicates.join(', ')}
                                            </div>
                                        ) : null;
                                    })()}
                                    <div className="holes-header">
                                        <span>Hole</span>
                                        <span>Par</span>
                                        <span>Stroke Index</span>
                                    </div>
                                    <div className="holes-list">
                                        {(() => {
                                            const duplicates = getDuplicateStrokeIndices(activeTeeId);
                                            return holesData[activeTeeId].map((hole, index) => (
                                                <div key={hole.hole_number} className="hole-row">
                                                    <span className="hole-number">{hole.hole_number}</span>
                                                    <select
                                                        value={hole.par}
                                                        onChange={(e) => updateHole(activeTeeId, index, 'par', parseInt(e.target.value))}
                                                        className="hole-input"
                                                    >
                                                        <option value={3}>3</option>
                                                        <option value={4}>4</option>
                                                        <option value={5}>5</option>
                                                    </select>
                                                    <select
                                                        value={hole.stroke_index}
                                                        onChange={(e) => updateHole(activeTeeId, index, 'stroke_index', parseInt(e.target.value))}
                                                        className={`hole-input ${duplicates.includes(hole.stroke_index) ? 'duplicate' : ''}`}
                                                    >
                                                        {Array.from({length: 18}, (_, i) => i + 1).map(num => (
                                                            <option key={num} value={num}>{num}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="button-primary"
                        disabled={!isValid || selectedTees.length === 0 || isSaving}
                    >
                        {isSaving
                            ? (mode === 'edit' ? 'Updating...' : 'Creating...')
                            : (mode === 'edit' ? 'Update Course' : 'Create Course')
                        }
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddCourseModal;
