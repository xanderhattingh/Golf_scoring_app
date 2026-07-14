import {useEffect, useState} from "react";
import HttpService from "../services/HttpService.ts";
import toast from "react-simple-toasts";
import "../styles/Components/create-tournament-modal.scss";

interface CourseTee {
    id: number;
    tee_name: string;
    gender?: string | null;
}

interface Course {
    id: number;
    name: string;
    location?: string | null;
    tees: CourseTee[];
}

interface ScoringMethod {
    id: number;
    name: string;
}

interface CreateTournamentModalProps {
    onClose: () => void;
    onCreated: (tournament: any) => void;
}

const CreateTournamentModal = ({onClose, onCreated}: CreateTournamentModalProps) => {
    const [methods, setMethods] = useState<ScoringMethod[]>([]);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [methodId, setMethodId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Four Ball (id 8) & Two Ball (id 11) Alliance: how many scores count per hole,
    // by par. The cap = size of the alliance (4 for fourball, 2 for two-ball).
    const mIdNum = Number(methodId);
    const isFourBallAlliance = mIdNum === 8;
    const isTwoBallAlliance = mIdNum === 11;
    const isAlliance = isFourBallAlliance || isTwoBallAlliance;
    const allianceMax = isTwoBallAlliance ? 2 : 4;
    const [allianceCounts, setAllianceCounts] = useState<{par3: number; par4: number; par5: number}>({par3: 4, par4: 4, par5: 4});

    // When switching between 4-ball / 2-ball, snap the values into the new cap so a
    // 2-ball tournament doesn't ship with "best 4 count" as its default.
    useEffect(() => {
        if (!isAlliance) return;
        setAllianceCounts(c => ({
            par3: Math.min(c.par3, allianceMax),
            par4: Math.min(c.par4, allianceMax),
            par5: Math.min(c.par5, allianceMax),
        }));
    }, [allianceMax, isAlliance]);

    // Course is searched on demand (too many to preload); tee comes from the picked course
    const [courseSearch, setCourseSearch] = useState('');
    const [courseResults, setCourseResults] = useState<Course[]>([]);
    const [isSearchingCourses, setIsSearchingCourses] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [teeId, setTeeId] = useState('');

    useEffect(() => {
        new HttpService().get('scoring-methods')
            .then((res) => setMethods(res.data?.data || []))
            .catch(() => toast('Failed to load scoring methods', {className: 'error-toast'}));
    }, []);

    // Server-side course search — nothing shown until the user types
    useEffect(() => {
        const q = courseSearch.trim();
        if (!q || selectedCourse) {
            setCourseResults([]);
            setIsSearchingCourses(false);
            return;
        }
        setIsSearchingCourses(true);
        const handle = setTimeout(() => {
            new HttpService().get(`courses?search=${encodeURIComponent(q)}`)
                .then((res) => setCourseResults(res.data?.data || []))
                .catch(() => toast('Failed to search courses', {className: 'error-toast'}))
                .finally(() => setIsSearchingCourses(false));
        }, 350);
        return () => clearTimeout(handle);
    }, [courseSearch, selectedCourse]);

    const tees = selectedCourse?.tees || [];

    const isValid = name.trim().length >= 2 && !!selectedCourse && !!teeId && !!methodId;

    const handleSelectCourse = (course: Course) => {
        setSelectedCourse(course);
        setCourseSearch('');
        setCourseResults([]);
        // auto-select the only tee, otherwise force a choice
        setTeeId(course.tees?.length === 1 ? String(course.tees[0].id) : '');
    };

    const handleClearCourse = () => {
        setSelectedCourse(null);
        setTeeId('');
    };

    const handleSubmit = () => {
        if (!isValid || isSaving || !selectedCourse) return;
        setIsSaving(true);
        const httpService = new HttpService();
        httpService.post('tournaments', {
            name: name.trim(),
            description: description.trim() || null,
            course_id: selectedCourse.id,
            tee_id: Number(teeId),
            scoring_method_id: Number(methodId),
            scoring_config: isAlliance ? {alliance: {...allianceCounts}} : null,
        })
            .then((res) => {
                if (res.data?.success) {
                    onCreated(res.data.data);
                    toast('Tournament created', {className: 'success-toast'});
                    onClose();
                } else {
                    toast(res.data?.message || 'Failed to create tournament', {className: 'error-toast'});
                }
            })
            .catch((error: any) => {
                toast(error.response?.data?.message || 'Failed to create tournament', {className: 'error-toast'});
            })
            .finally(() => setIsSaving(false));
    };

    return (
        <div className="modal-container">
            <div className="modal-content create-tournament">
                <div className="modal-header">
                    <div className="header">Create Tournament</div>
                    <button type="button" className="close-button" onClick={onClose}>&times;</button>
                </div>

                <form className="ct-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} autoComplete="off">
                    <div className="input-group">
                        <label className="input-label">Tournament Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Saturday Fourball Cup"
                            maxLength={255}
                            autoComplete="off"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Description</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional"
                            maxLength={255}
                            autoComplete="off"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Course *</label>
                        {selectedCourse ? (
                            <button type="button" className="ct-selected" onClick={handleClearCourse}>
                                <span className="ct-selected__name">{selectedCourse.name}</span>
                                <span className="ct-selected__change">Change</span>
                            </button>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={courseSearch}
                                    onChange={(e) => setCourseSearch(e.target.value)}
                                    placeholder="Search courses..."
                                    autoComplete="off"
                                />
                                {courseSearch.trim() && (
                                    <div className="ct-results">
                                        {isSearchingCourses && (
                                            <div className="ct-results__msg">Searching…</div>
                                        )}
                                        {!isSearchingCourses && courseResults.length === 0 && (
                                            <div className="ct-results__msg">No courses found</div>
                                        )}
                                        {courseResults.map((c) => (
                                            <button
                                                type="button"
                                                key={c.id}
                                                className="ct-results__item"
                                                onClick={() => handleSelectCourse(c)}
                                            >
                                                <span className="ct-results__name">{c.name}</span>
                                                {c.location && <span className="ct-results__sub">{c.location}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {selectedCourse && (
                        <div className="input-group">
                            <label className="input-label">Tee *</label>
                            <select value={teeId} onChange={(e) => setTeeId(e.target.value)}>
                                <option value="">Select a tee</option>
                                {tees.map(t => <option key={t.id} value={t.id}>{t.tee_name}{t.gender ? ` (${t.gender})` : ''}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="input-group">
                        <label className="input-label">Scoring Method *</label>
                        <select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                            <option value="">Select scoring method</option>
                            {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>

                    {isAlliance && (
                        <div className="input-group">
                            <label className="input-label">Scores to count per hole</label>
                            <div className="ct-alliance">
                                {([['par3', 'Par 3s'], ['par4', 'Par 4s'], ['par5', 'Par 5s']] as const).map(([key, label]) => (
                                    <div key={key} className="ct-alliance__row">
                                        <span className="ct-alliance__label">{label}</span>
                                        <div className="ct-alliance__stepper">
                                            <button
                                                type="button"
                                                disabled={allianceCounts[key] <= 1}
                                                onClick={() => setAllianceCounts(c => ({...c, [key]: Math.max(1, c[key] - 1)}))}
                                            >−</button>
                                            <span className="ct-alliance__val">{allianceCounts[key]}</span>
                                            <button
                                                type="button"
                                                disabled={allianceCounts[key] >= allianceMax}
                                                onClick={() => setAllianceCounts(c => ({...c, [key]: Math.min(allianceMax, c[key] + 1)}))}
                                            >+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="ct-hint">A 6-digit invite code is generated automatically so players can join.</p>

                    <button type="submit" className="ct-submit" disabled={!isValid || isSaving}>
                        {isSaving ? 'Creating…' : 'Create Tournament'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateTournamentModal;
