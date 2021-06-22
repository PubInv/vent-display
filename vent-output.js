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
				border-radius: 2%;
				cursor: default;
				width:75%;
				height:25%;
				padding:2%;
				margin: 1%;
			}
			.box {
				text-align:center;
				font-size: 2em;
				margin-bottom: 1px;
				background-color: #DCDCDC;
				border-radius: 5px;
				border-width:1px;
				width: 100px;
				height: 50px;
				padding:5px;
				box-sizing: border-box;
				size:100;
				
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
			.limit_max {
				display: flex;
				flex-direction: row;
			  }
			.limit_min {
				display: flex;
				flex-direction: row;
			}	
		</style>
		
		<div class="vent-output">
		<div class="flex-container">
			<div> <span class="v">00</span>
			<vent-input l="Pinsp" v="45" u="cmH2O"></vent-input>
			<br>
			<span class="l">label</span>
			<span class="u">cmH2O</span>
			</div>

			<div class="flex-container">
				<span class="vertical_alarms">
				<div class="limit_max">
                	<label for="max_h">H:</label>
                	<input class="box" id="max_h" type='text' value=""> </input>
                </div>
		
				<div class="limit_min">
					<label for="max_l">L:</label>
                    <input class="box" id="max_l" type='text'value="43"> </input>
                </div>


			</div>
		</div>  
		
			
			
			
			
		</div>		
		`;
  }

  connectedCallback() {
    this._ventbutton = this.shadowRoot.querySelector(".vent-output");
  }

  diconnectedCallback() {}

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
