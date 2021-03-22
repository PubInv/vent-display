const template = document.createElement('template');
template.innerHTML = `
<style>
	.vent-input {
		width:100px;
		height:100px;
		
	}

	.val {
		font-size: 3em;
		color: #ffffff;
	}

	.name {
		font-size: 1em;
		color: #ffffff;
	}

	button {
		display: block;
		width: 100%;
		height: 100%;
		border: none;
		background-color: #20B2AA;
		cursor: pointer;
		padding: 14px 28px;
	}
	
</style>


<div class = "vent-input">
	<button ventinput>
		<span class="val">00</span>
		<span class="label">abc</span>
	</button>
</div>		
`;


class VentInput extends HTMLElement {
	// Specify observed attributes so that
  	// attributeChangedCallback will work
	static get observedAttributes() {
		return ['val', 'label'];
	}
	
	constructor() {
		super();
		this._ventbutton;
		this._isSelected = false;
		this._currentVal = 0;
		this.attachShadow({ mode: 'open' });
		this.shadowRoot.appendChild(template.content.cloneNode(true));
	}
	
	connectedCallback() {
		this._ventbutton = this.shadowRoot.querySelector(".vent-input");
		this.shadowRoot.querySelector("button").addEventListener('click', this._doSomething.bind(this));
		this.shadowRoot.querySelector("button").addEventListener('wheel', this._scroll.bind(this));
	}

	diconnectedCallback(){
		this.shadowRoot.querySelector("button").removeEventListener('click', this._doSomething);
		this.shadowRoot.querySelector("button").removeEventListener('wheel', this._scroll);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name == 'val') {
			this.shadowRoot.querySelector('.val').innerHTML = newValue;
			this._currentVal = newValue;		
		}
		else if (name == 'label') {
			this.shadowRoot.querySelector('.label').innerHTML = newValue;
		}
	}
	
	_scroll(event) {
		if (this._isSelected){
			event.preventDefault();

			if (event.deltaY < 0) {
				this._currentVal++;
			} else {
				this._currentVal--;
			}
		
			this.shadowRoot.querySelector('.val').innerHTML = this._currentVal;
		}
	}
	  
	
	_doSomething(){
		this._isSelected = !this._isSelected;
	}
	
	
}
customElements.define('vent-input', VentInput);