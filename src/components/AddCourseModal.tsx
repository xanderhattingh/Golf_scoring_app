import "../styles/Components/add-course-modal.scss"
import InputGroup from "./InputGroup.tsx";
import {z} from "zod";
import {useEffect, useState} from "react";
import {useFieldArray, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import LocalDataService from "../services/LocalDataService.ts";
import toast from "react-simple-toasts";
import 'react-simple-toasts/dist/style.css';
import 'react-simple-toasts/dist/theme/failure.css';
import 'react-simple-toasts/dist/theme/success.css';

const hole_schema = z.object({
    hole_number: z.number().int().min(1).max(18),
    hole_par: z.number().int().min(3).max(5),
    hole_stroke: z.number().int().min(0).max(18),
})

const course_schema = z.object({
    course_name: z.string().min(2).max(255),
    holes: z.array(hole_schema)
})

const AddCourseModal = (props) => {
    const {mode = 'add', course, onCourseAdded, onCourseUpdated, onCloseModal} = props

    const {
        register: course_form,
        control,
        getValues,
        setValue,
        formState: {isValid},
        handleSubmit,
        reset
    } = useForm({
        resolver: zodResolver(course_schema),
        defaultValues: mode === 'edit' && course ? {
            course_name: course.name,
            holes: course.holes
        } : undefined
    })

    const {fields, append} = useFieldArray({
        control,
        name: 'holes',
    })

    const [bulkPars, setBulkPars] = useState('');
    const [bulkStrokes, setBulkStrokes] = useState('');
    const [bulkError, setBulkError] = useState('');

    const parseNumbers = (input: string): number[] => {
        return input
            .split(/[\s,]+/)
            .map(s => s.trim())
            .filter(s => s !== '')
            .map(s => parseInt(s, 10))
            .filter(n => !isNaN(n));
    };

    const applyBulkPars = () => {
        const pars = parseNumbers(bulkPars);
        if (pars.length !== 18) {
            setBulkError(`Pars: Expected 18 values, got ${pars.length}`);
            return;
        }
        const invalidPars = pars.filter(p => p < 3 || p > 5);
        if (invalidPars.length > 0) {
            setBulkError(`Pars must be between 3 and 5. Invalid: ${invalidPars.join(', ')}`);
            return;
        }
        setBulkError('');
        pars.forEach((par, i) => {
            setValue(`holes.${i}.hole_par`, par);
        });
        toast('Pars applied successfully', {theme: 'success', duration: 2000});
    };

    const applyBulkStrokes = () => {
        const strokes = parseNumbers(bulkStrokes);
        if (strokes.length !== 18) {
            setBulkError(`Strokes: Expected 18 values, got ${strokes.length}`);
            return;
        }
        const invalidStrokes = strokes.filter(s => s < 1 || s > 18);
        if (invalidStrokes.length > 0) {
            setBulkError(`Strokes must be between 1 and 18. Invalid: ${invalidStrokes.join(', ')}`);
            return;
        }
        const uniqueStrokes = new Set(strokes);
        if (uniqueStrokes.size !== 18) {
            setBulkError('Strokes must be unique (1-18, each used once)');
            return;
        }
        setBulkError('');
        strokes.forEach((stroke, i) => {
            setValue(`holes.${i}.hole_stroke`, stroke);
        });
        toast('Strokes applied successfully', {theme: 'success', duration: 2000});
    };

    useEffect(() => {
        if (mode === 'edit' && course) {
            reset({
                course_name: course.name,
                holes: course.holes
            })
        } else {
            for (let i = 1; i <= 18; i++) {
                if (getValues().holes?.length < 18 || !getValues().holes) {
                    append({hole_number: i, hole_par: 4, hole_stroke: 0})
                }
            }
        }
    }, [])

    const onCreateCourse = (values) => {
        const dataService = new LocalDataService();

        try {
            if (mode === 'edit') {
                const updatedCourse = dataService.updateCourse({
                    course_id: course.id,
                    course_name: values.course_name,
                    holes: values.holes
                });
                onCourseUpdated(updatedCourse);
            } else {
                const newCourse = dataService.addCourse({
                    course_name: values.course_name,
                    holes: values.holes
                });
                onCourseAdded(newCourse);
            }
        } catch (error: any) {
            if (error.status === 422) {
                toast('Course already exists', {theme: 'failure', duration: 3000});
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
                        <div className="header">{mode === 'edit' ? 'Edit Course' : 'Course Details'}</div>
                        <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                    </div>
                    <form className="add-course-form" onSubmit={handleSubmit(onCreateCourse)}>
                        <InputGroup
                            label_value="Course Name"
                            {...course_form("course_name")}
                            placeholder="Course name"
                            type="text"
                        ></InputGroup>

                        <div className="bulk-input-section">
                            <div className="bulk-input-header">Quick Entry (comma or space separated)</div>
                            {bulkError && <div className="bulk-error">{bulkError}</div>}
                            <div className="bulk-input-row">
                                <input
                                    type="text"
                                    placeholder="Pars: 4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4"
                                    value={bulkPars}
                                    onChange={(e) => setBulkPars(e.target.value)}
                                    className="bulk-input"
                                />
                                <button type="button" onClick={applyBulkPars} className="bulk-apply-btn">
                                    Apply Pars
                                </button>
                            </div>
                            <div className="bulk-input-row">
                                <input
                                    type="text"
                                    placeholder="Strokes: 7,15,1,11,5,17,3,9,13,8,16,2,12,6,18,4,10,14"
                                    value={bulkStrokes}
                                    onChange={(e) => setBulkStrokes(e.target.value)}
                                    className="bulk-input"
                                />
                                <button type="button" onClick={applyBulkStrokes} className="bulk-apply-btn">
                                    Apply Strokes
                                </button>
                            </div>
                        </div>

                        {
                            fields?.map((_, i) => (
                                <div key={i} className="split">
                                    <InputGroup
                                        readOnly={true}
                                        label_value="Hole Number"
                                        {...course_form(`holes.${i}.hole_number`, {valueAsNumber: true})}
                                        placeholder="Hole number"
                                        type="number"
                                    ></InputGroup>
                                    <InputGroup
                                        label_value="Hole Par"
                                        {...course_form(`holes.${i}.hole_par`, {valueAsNumber: true})}
                                        placeholder="Hole Par"
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                    ></InputGroup>
                                    <InputGroup
                                        label_value="Hole Stroke"
                                        {...course_form(`holes.${i}.hole_stroke`, {valueAsNumber: true})}
                                        placeholder="Hole Stroke"
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                    ></InputGroup>
                                </div>

                            ))
                        }
                        <button type={'submit'} className="button-primary" disabled={!isValid}>
                            {mode === 'edit' ? 'Update Course' : 'Create Course'}
                        </button>
                    </form>
                </div>
            </div>

        </>
    )


}
export default AddCourseModal
