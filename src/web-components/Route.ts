import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('notention-route')
export class Route extends LitElement {
  @property({ type: String }) path: string = '';
  @property({ type: String }) component: string = '';

  render() {
    return null; // Route component doesn't render anything itself
  }
}
