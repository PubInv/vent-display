class VentOutput extends HTMLElement {
	// Specify observed attributes so that
	// attributeChangedCallback will work
	static get observedAttributes() {
		return ["v", "l", "u"];
	}

	constructor() {
		super();
		this._ventbutton;
		this.attachShadow({ mode: "open" });
		this.shadowRoot.innerHTML = `
		<style>
		.flex-container {
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			flex-wrap: wrap;
		}
			.vent-output {
				
				border: solid 1px #105955;
				background-color: #90D9D5;
				border-radius: 10px;
				cursor: default;
				padding: 8px 20px 8px 20px;
				margin: 5px;
				//width:100%;
				//height:25%;
				//padding:2%;
				
			}
			.limit {
				display:flex;
				text-align:center;
				font-size: 2em;
				margin-bottom: 1%;
				background-color: #DCDCDC;
				border-radius:1%;
				border-width:0.5%;
				width: 75%;
				height: 60%;
				padding:1%;
			}

			.container{
				display:flex;
				flex-direction:row;
				justify-content: space-between;
				
				flex-wrap: wrap;
				width: 40%;
				height: 25%;
				padding:2%;
				margin:1%;
				border :1px ;
			}
		
			.v {
				font-size: 4em;
				color: #ffffff;
				margin:0;
				padding:0;
				line-height: 90%;
			}

			.labels div {
				margin-right:10px;
			}

			.labels {
				display:flex;
			}
			
		</style>
		
		<div class="vent-output">
			<div class="flex-container">
				<div class="container">
					<div>
					<span class="v">00</span>
					<br>
					<span class="l">label</span>
					<span class="u">cmH2O</span>
					</div>
				</div>	

				<div class ="container">
					<div><input class="limit" id="max_h" type='text' value="48"> </input></div>
					<div><input class="limit" id="max_l" type='text'value="43"> </input></div>
				</div>
			</div>  	
		</div>		
		`;
	}

	connectedCallback() {
		this._ventbutton = this.shadowRoot.querySelector(".vent-output");
	}

	diconnectedCallback() { }

	attributeChangedCallback(name, oldValue, newValue) {
		if (name == "v") {
			this.shadowRoot.querySelector(".v").innerHTML = newValue;
			this._currentVal = newValue;
		} else if (name == "l") {
			this.shadowRoot.querySelector(".l").innerHTML = newValue;
		} else if (name == "u") {
			this.shadowRoot.querySelector(".u").innerHTML = newValue;
		}
	}
}
customElements.define("vent-output", VentOutput);
