import {useEffect, useState} from 'react';
import GolfCourseApiService, {type ApiCourse} from '../services/GolfCourseApiService';
import HttpService from '../services/HttpService';
import ConfirmDialog from './ConfirmDialog';

import '../styles/Components/modal.scss';
import toast from 'react-simple-toasts';

interface ExistingCourse {
    id: number;
    name: string;
    location: string | null;
}

interface Tee {
    id: number;
    name: string;
    description: string;
    colour_code: string;
}

interface ApiImportModalProps {
    onClose: () => void;
    onCourseImported: () => void;
}

const colorToHex: Record<string, string> = {
    yellow: '#FFD700',
    white: '#FFFFFF',
    red: '#DC143C',
    blue: '#4169E1',
    green: '#228B22',
    black: '#000000',
    gold: '#FFD700',
    silver: '#C0C0C0',
    orange: '#FFA500',
    purple: '#800080',
    pink: '#FFC0CB',
};

const ApiImportModal = ({onClose, onCourseImported}: ApiImportModalProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ApiCourse[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<ApiCourse | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState('');
    const [existingCourses, setExistingCourses] = useState<ExistingCourse[]>([]);
    const [similarCourse, setSimilarCourse] = useState<ExistingCourse | null>(null);
    const [availableTees, setAvailableTees] = useState<Tee[]>([]);

    // Fetch existing courses and available tees on mount
    useEffect(() => {
        const fetchExistingCourses = async () => {
            try {
                const httpService = new HttpService();
                const response = await httpService.get("courses");
                setExistingCourses(response.data.data || []);
            } catch (err) {
                console.error("Failed to fetch existing courses:", err);
            }
        };
        const fetchTees = async () => {
            try {
                const httpService = new HttpService();
                const response = await httpService.get("courses/tees");
                setAvailableTees(response.data.data || []);
            } catch (err) {
                console.error("Failed to fetch tees:", err);
            }
        };
        fetchExistingCourses();
        fetchTees();
    }, []);

    // Check for similar course names (case-insensitive, checks if one contains the other)
    const findSimilarCourse = (courseName: string): ExistingCourse | null => {
        const normalizedName = courseName.toLowerCase().trim();

        for (const existing of existingCourses) {
            const existingNormalized = existing.name.toLowerCase().trim();

            // Check if names are similar (one contains the other or high similarity)
            if (existingNormalized === normalizedName ||
                existingNormalized.includes(normalizedName) ||
                normalizedName.includes(existingNormalized)) {
                return existing;
            }

            // Check word similarity (if 2+ words match)
            const existingWords = existingNormalized.split(/\s+/);
            const newWords = normalizedName.split(/\s+/);
            const matchingWords = existingWords.filter(w => newWords.includes(w) && w.length > 2);
            if (matchingWords.length >= 2) {
                return existing;
            }
        }
        return null;
    };

    const handleCourseSelect = (course: ApiCourse) => {
        setSelectedCourse(course);
        setError('');

        // Check for similar course
        const similar = findSimilarCourse(course.course_name);
        if (similar) {
            setSimilarCourse(similar);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setError('');
        setSearchResults([]);
        setSelectedCourse(null);
        setSimilarCourse(null);

        try {
            const results = await GolfCourseApiService.searchCourses(searchQuery);
            setSearchResults(results);
            if (results.length === 0) {
                setError('No courses found. Try a different search term.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to search courses');
        } finally {
            setIsSearching(false);
        }
    };

    const handleConfirmSameCourse = () => {
        // User says it's the same course - cancel import
        setSimilarCourse(null);
        toast("Import cancelled - course already exists.", {className: "warning-toast"});
        setSelectedCourse(null);
    };

    const handleConfirmDifferentCourse = () => {
        // User says it's different - proceed with import
        setSimilarCourse(null);
        doImport();
    };

    const handleImport = async () => {
        if (!selectedCourse) return;

        // If we haven't checked for similar courses yet, check now
        const similar = findSimilarCourse(selectedCourse.course_name);
        if (similar) {
            setSimilarCourse(similar);
            return;
        }

        doImport();
    };

    const doImport = async () => {
        if (!selectedCourse) return;

        setIsImporting(true);
        setError('');

        try {
            // Get all available color tees dynamically from male tees
            const colorTees = GolfCourseApiService.getAllColorTeesDynamic(selectedCourse);

            if (Object.keys(colorTees).length === 0) {
                setError('No recognizable tees found for this course. Please select a different course.');
                setIsImporting(false);
                return;
            }

            // Build dynamic color -> tee_id map from available tees fetched from backend
            const colorToTeeId: Record<string, number> = {};
            for (const tee of availableTees) {
                colorToTeeId[tee.name.toLowerCase()] = tee.id;
            }

            // Create any missing tees on the backend
            const httpService = new HttpService();
            const newTees: Tee[] = [];
            for (const color of Object.keys(colorTees)) {
                if (!colorToTeeId[color]) {
                    const response = await httpService.post('tees', {
                        name: color.charAt(0).toUpperCase() + color.slice(1),
                        description: color.charAt(0).toUpperCase() + color.slice(1),
                        colour_code: colorToHex[color] || '#CCCCCC',
                    });
                    const newTee = response.data.data;
                    newTees.push(newTee);
                    colorToTeeId[color] = newTee.id;
                }
            }

            if (newTees.length > 0) {
                setAvailableTees(prev => [...prev, ...newTees]);
            }

            // Transform each color tee to our format
            const teesData = [];
            for (const [color, tee] of Object.entries(colorTees)) {
                const mappedTeeId = colorToTeeId[color];
                if (!mappedTeeId) {
                    continue; // Skip colors that couldn't be resolved
                }

                const holes = tee.holes.map((hole, index) => ({
                    hole_number: index + 1,
                    par: hole.par,
                    stroke_index: index + 1, // Default stroke index to hole number
                }));

                // Ensure we have 18 holes
                while (holes.length < 18) {
                    holes.push({
                        hole_number: holes.length + 1,
                        par: 4,
                        stroke_index: holes.length + 1,
                    });
                }

                teesData.push({
                    tee_id: mappedTeeId,
                    holes: holes.slice(0, 18)
                });
            }

            if (teesData.length === 0) {
                setError('No matching tees found in the database. Please ensure tees are configured.');
                setIsImporting(false);
                return;
            }

            await httpService.post("courses", {
                name: selectedCourse.course_name,
                location: [selectedCourse.location?.city, selectedCourse.location?.state, selectedCourse.location?.country].filter(Boolean).join(', ') || null,
                num_holes: 18,
                tees: teesData
            });

            const teeNames = Object.keys(colorTees).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
            toast(`Course imported with ${teeNames} tees! Edit to adjust stroke indices.`, {className: "success-toast"});
            onCourseImported();
            onClose();
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || 'Failed to import course';
            setError(message);
        } finally {
            setIsImporting(false);
        }
    };


    const formatLocation = (course: ApiCourse) => {
        const loc = course.location;
        const parts = [loc?.city, loc?.state, loc?.country].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : '';
    };

    const formatExistingLocation = (location: string | null): string => {
        if (!location) return '';

        // Filter out "Unknown" values and clean up the location string
        const parts = location.split(',').map(p => p.trim()).filter(p => p && p.toLowerCase() !== 'unknown');

        if (parts.length === 0) return '';
        return ` (${parts.join(', ')})`;
    };

    const getTeeInfo = (course: ApiCourse) => {
        const colorTees = GolfCourseApiService.getAllColorTeesDynamic(course);
        const teeNames = Object.keys(colorTees);

        if (teeNames.length === 0) return 'No standard tees available';

        return teeNames.map(color => {
            const tee = colorTees[color];
            const displayName = tee.tee_name.match(/re-rate/i)
                ? `${color.charAt(0).toUpperCase() + color.slice(1)} (Re-Rate)`
                : color.charAt(0).toUpperCase() + color.slice(1);
            return `${displayName} (Par ${tee.par_total})`;
        }).join(' • ');
    };

    return (
        <div className="modal-container">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Import from API</h3>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <p className="modal-description">
                    Search for a golf course name to import hole pars from available tees.
                </p>

                <div className="search-row">
                    <input
                        type="text"
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter course name..."
                    />
                    <button
                        className="button-primary"
                        onClick={handleSearch}
                        disabled={isSearching || !searchQuery.trim()}
                    >
                        {isSearching ? 'Searching...' : 'Search'}
                    </button>
                </div>

                {error && <p className="modal-error">{error}</p>}

                {searchResults.length > 0 && (
                    <div className="search-results">
                        {searchResults.map((course) => (
                            <div
                                key={course.id}
                                className={`search-result-item ${selectedCourse?.id === course.id ? 'selected' : ''}`}
                                onClick={() => handleCourseSelect(course)}
                            >
                                <div className="result-name">{course.course_name}</div>
                                {formatLocation(course) && (
                                    <div className="result-location">{formatLocation(course)}</div>
                                )}
                                <div className="result-tee-info">{getTeeInfo(course)}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="modal-actions">
                    <button className="button-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="button-primary"
                        onClick={handleImport}
                        disabled={!selectedCourse || isImporting}
                    >
                        {isImporting ? 'Importing...' : 'Import'}
                    </button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!similarCourse}
                title="Similar Course Found"
                message={similarCourse ?
                    `A course named "${similarCourse.name}"${formatExistingLocation(similarCourse.location)} already exists. Is this the same course?` :
                    ''}
                confirmText="Same Course - Cancel Import"
                cancelText="Different Course - Import Anyway"
                variant="warning"
                onConfirm={handleConfirmSameCourse}
                onCancel={handleConfirmDifferentCourse}
            />
        </div>
    );
};

export default ApiImportModal;
