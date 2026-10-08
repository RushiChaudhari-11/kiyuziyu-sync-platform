import React from "react";

const HeroCentered = ({data, theme}) => {

return (

<section style={{textAlign:"center",padding:"120px 20px"}}>

<h1>{data.title}</h1>

<p>{data.subtitle}</p>

</section>

);

};

export default HeroCentered;