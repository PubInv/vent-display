class MyButton extends HTMLElement {
	constructor() {
		super();
		this._mybutton;
		this.attachShadow({ mode: 'open' });
		this.shadowRoot.innerHTML = `
			<style>
				.mybutton {
					background-color: #ff8811;
					padding: 30px;
				}
			</style>
			
			
			<div class = "mybutton">
				<slot name="myheader">
					<h2>Click the button</h2>
				</slot>
				<button>
					<slot name="abutton">My button</slot>
				</button>
			</div>
		
		`
	}
	connectedCallback() {
		this._mybutton = this.shadowRoot.querySelector(".mybutton");
		this.shadowRoot.querySelector("button").addEventListener('click', this._doSomething.bind(this));
	}
	//attributeChangeCallback();
	diconnectedCallback(){
		this.shadowRoot.querySelector("button").removeEventListener('click', this._doSomething);
	}
	
	_doSomething(){
		console.log("Doing something");
	}
	
}
customElements.define('my-button', MyButton);