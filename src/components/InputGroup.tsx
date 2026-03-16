import InputLabel from "./InputLabel.tsx";
import "../styles/Components/forms.scss"
import Input from "./Input.tsx";

const InputGroup = (props) => {
    const {label_value, ...inputProps} = props;
    return (
        <div className="input-group">
            <InputLabel label_value={label_value}></InputLabel>
            <Input {...inputProps}></Input>
        </div>
    )
}
export default InputGroup
