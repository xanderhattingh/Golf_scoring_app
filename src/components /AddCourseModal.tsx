import "../styles/Components/add-course-modal.scss"
import InputGroup from "./InputGroup.tsx";
import {z} from "zod";
import {useEffect, useState} from "react";
import {useFieldArray, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useTesseract} from 'react-tesseract';
import HttpService from "../services/HttpService.ts";
import {HashLoader} from "react-spinners";
import toast from "react-simple-toasts";

const hole_schema = z.object({
    hole_number: z.int().min(1).max(18),
    hole_par: z.int().min(3).max(5),
    hole_stroke: z.int().min(1).max(18),
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

    const [imageUrlFirstNinePars, setImageUrlFirstNinePars] = useState('');
    const {
        recognize: recognizeFirstNinePars,
        error: errorFirstNinePars,
        isRecognizing: isRecognizingFirstNinePars
    } = useTesseract();

    const [imageUrlSecondNinePars, setImageUrlSecondNinePars] = useState('');
    const {
        recognize: recognizeSecondNinePars,
        error: errorSecondNinePars,
        isRecognizing: isRecognizingSecondNinePars
    } = useTesseract();

    const [imageUrlFirstNineStrokes, setImageUrlFirstNineStrokes] = useState('');
    const {
        recognize: recognizeFirstNineStrokes,
        error: errorFirstNineStrokes,
        isRecognizing: isRecognizingFirstNineStrokes
    } = useTesseract();

    const [imageUrlSecondNineStrokes, setImageUrlSecondNineStrokes] = useState('');
    const {
        recognize: recognizeSecondNineStrokes,
        error: errorSecondNineStrokes,
        isRecognizing: isRecognizingSecondNineStrokes
    } = useTesseract();


    useEffect(() => {
        if (mode === 'edit' && course) {
            reset({
                course_name: course.name,
                holes: course.holes
            })
            console.log(getValues());
        } else {
            for (let i = 1; i <= 18; i++) {
                if (getValues().holes?.length < 18 || !getValues().holes) {
                    append({hole_number: i, hole_par: 4, hole_stroke: 0})
                }
            }
        }

        console.log(getValues());
    }, [])


    const [loading, setLoading] = useState(false);

    const onCreateCourse = async (values) => {
        setLoading(true);
        const apiService = new HttpService();

        const endpoint = mode === 'edit' ? '/edit_course' : '/add_course';
        const payload = mode === 'edit' ? {...values, course_id: course.id} : values;

        const {request, cancel} = await apiService.post(endpoint, payload);

        request.then(
            (response) => {
                setLoading(false);
                if (mode === 'edit') {
                    onCourseUpdated(response?.data)
                } else {
                    onCourseAdded(response?.data)
                }

            },
            (error) => {
                if (error.status === 422) {
                    setLoading(false);
                    toast('Course already exists', {theme: 'failure', duration: 3000});
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


    const handleImageChangeFirstNinePars = async (e) => {
        setImageUrlFirstNinePars(URL.createObjectURL(e.target.files[0]))
    };

    useEffect(() => {
        const recog = async () => {
            if (imageUrlFirstNinePars) {
                await recognizeFirstNinePars(imageUrlFirstNinePars, {
                    language: 'eng',  // Use English and Arabic
                    errorHandler: (err) => console.error(err),  // Custom error handler
                    tessedit_ocr_engine_mode: 1,  // Use neural net LSTM engine only
                    tessedit_pageseg_mode: 1,  // Assume a single uniform block of text
                    // ... any other Tesseract.js options
                })
                    .then((res) => {
                        for (let i = 0; i < 9; i++) {
                            for (let k = 0; k < fields.length / 2; k++) {
                                if (fields[k].hole_number == i + 1) {
                                    setValue(`holes.${k}.hole_par`, parseInt(res.symbols[i].text), {
                                        shouldDirty: true,
                                        shouldValidate: true
                                    });
                                }
                            }
                        }
                    })
            }

        }
        recog()
    }, [imageUrlFirstNinePars])

    const handleImageChangeSecondNinePars = (e) => {
        setImageUrlSecondNinePars(URL.createObjectURL(e.target.files[0]));
    };

    useEffect(() => {
        const recog = async () => {
            if (imageUrlSecondNinePars) {
                await recognizeSecondNinePars(imageUrlSecondNinePars, {
                    language: 'eng',  // Use English and Arabic
                    errorHandler: (err) => console.error(err),  // Custom error handler
                    tessedit_ocr_engine_mode: 1,  // Use neural net LSTM engine only
                    tessedit_pageseg_mode: 1,  // Assume a single uniform block of text
                    // ... any other Tesseract.js options
                })
                    .then((res) => {
                        for (let i = 0; i < 9; i++) {
                            for (let k = 8; k < fields.length; k++) {
                                if (fields[k].hole_number == (i + 1) + 9) {
                                    setValue(`holes.${k}.hole_par`, parseInt(res.symbols[i].text), {
                                        shouldDirty: true,
                                        shouldValidate: true
                                    });
                                }
                            }
                        }
                    })
            }

        }
        recog()
    }, [imageUrlSecondNinePars])

    const handleImageChangeFirstNineStrokes = (e) => {
        setImageUrlFirstNineStrokes(URL.createObjectURL(e.target.files[0]));
    };

    useEffect(() => {
        const recog = async () => {
            if (imageUrlFirstNineStrokes) {
                await recognizeFirstNineStrokes(imageUrlFirstNineStrokes, {
                    language: 'eng',  // Use English and Arabic
                    errorHandler: (err) => console.error(err),  // Custom error handler
                    tessedit_ocr_engine_mode: 1,  // Use neural net LSTM engine only
                    tessedit_pageseg_mode: 1,  // Assume a single uniform block of text
                    // ... any other Tesseract.js options
                })
                    .then((res) => {
                        console.log(res);
                        for (let i = 0; i < 9; i++) {
                            for (let k = 0; k < fields.length / 2; k++) {
                                if (fields[k].hole_number == i + 1) {
                                    setValue(`holes.${k}.hole_stroke`, parseInt(res.words[i].text), {
                                        shouldDirty: true,
                                        shouldValidate: true
                                    });
                                }
                            }
                        }
                    })
            }

        }
        recog()
    }, [imageUrlFirstNineStrokes])

    const handleImageChangeSecondNineStrokes = (e) => {
        setImageUrlSecondNineStrokes(URL.createObjectURL(e.target.files[0]));
    };

    useEffect(() => {
        const recog = async () => {
            if (imageUrlSecondNineStrokes) {
                await recognizeSecondNineStrokes(imageUrlSecondNineStrokes, {
                    language: 'eng',  // Use English and Arabic
                    errorHandler: (err) => console.error(err),  // Custom error handler
                    tessedit_ocr_engine_mode: 1,  // Use neural net LSTM engine only
                    tessedit_pageseg_mode: 1,  // Assume a single uniform block of text
                    // ... any other Tesseract.js options
                    tessedit_char_whitelist: '0123456789'
                })
                    .then((res) => {
                        console.log(res);
                        for (let i = 0; i < 9; i++) {
                            for (let k = 8; k < fields.length; k++) {
                                if (fields[k].hole_number == (i + 1) + 9) {
                                    setValue(`holes.${k}.hole_stroke`, parseInt(res.words[i].text), {
                                        shouldDirty: true,
                                        shouldValidate: true
                                    });
                                }
                            }
                        }
                    })
            }
        }
        recog()
    }, [imageUrlSecondNineStrokes])


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
                            <div className="course-details">
                                <div className="label">
                                    First nine pars
                                </div>
                                <button type={'button'} className="button-primary" onClick={() => {
                                    document.getElementById("first_nine_pars").click()
                                }}>Image
                                </button>
                                <input id="first_nine_pars" type="file" onChange={handleImageChangeFirstNinePars}/>

                                {errorFirstNinePars && <p>Error: {errorFirstNinePars}</p>}
                            </div>
                            <div className="course-details">
                                <div className="label">
                                    Second nine pars
                                </div>
                                <button type={'button'} className="button-primary" onClick={() => {
                                    document.getElementById("second_nine_pars").click()
                                }}>Image
                                </button>
                                <input id="second_nine_pars" type="file" onChange={handleImageChangeSecondNinePars}/>

                                {errorSecondNinePars && <p>Error: {errorSecondNinePars}</p>}
                            </div>
                            <div className="course-details">
                                <div className="label">
                                    First nine strokes
                                </div>
                                <button type={'button'} className="button-primary" onClick={() => {
                                    document.getElementById("first_nine_strokes").click()
                                }}>Image
                                </button>
                                <input id="first_nine_strokes" type="file"
                                       onChange={handleImageChangeFirstNineStrokes}/>

                                {errorFirstNineStrokes && <p>Error: {errorFirstNineStrokes}</p>}
                            </div>
                            <div className="course-details">
                                <div className="label">
                                    Second nine strokes
                                </div>
                                <button type={'button'} className="button-primary" onClick={() => {
                                    document.getElementById("second_nine_strokes").click()
                                }}>Image
                                </button>
                                <input id="second_nine_strokes" type="file"
                                       onChange={handleImageChangeSecondNineStrokes}/>
                                {errorSecondNineStrokes && <p>Error: {errorSecondNineStrokes}</p>}
                            </div>

                            {
                                fields?.map((field, i) => (
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
                                        ></InputGroup>
                                        <InputGroup
                                            label_value="Hole Stroke"
                                            {...course_form(`holes.${i}.hole_stroke`, {valueAsNumber: true})}
                                            placeholder="Hole Stroke"
                                            type="number"
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


}
export default AddCourseModal
