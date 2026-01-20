import React from 'react'

const InputLabel = (props) => {
	const { label_value } = props;
	return (
		<label className="input-label">{label_value}</label>
	)
}
export default InputLabel
