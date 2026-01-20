import InputLabel from "./InputLabel.tsx";
import "../styles/Components/forms.scss"
import Input from "./Input.tsx";

const InputGroup = (props) => {
    return (
        <div className="input-group">
            <InputLabel label_value={props.label_value}></InputLabel>
            <Input {...props}></Input>
        </div>
    )
}
export default InputGroup
