import { Component, HostListener, Inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { KeyBinder } from '@thegraid/easeljs-lib';
import type { Event } from '@thegraid/easeljs-module';
import { StageComponent } from './stage/stage.component';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: true,
    imports: [StageComponent]
})
export class AppComponent {
  get title() { return this.titleService.getTitle(); }
  linkName = `${this.title} - User Guide`;
  timestamp = `${new Date().toLocaleTimeString('en-US')}`;

  constructor(@Inject(KeyBinder) private keyBinder: KeyBinder, private titleService: Title) { }

  // app.component has access to the 'Host', so we use @HostListener here
  // Listen to all Host events and forward them to our internal EventDispatcher
  @HostListener('document:keyup', ['$event'])
  @HostListener('document:keydown', ['$event'])
  @HostListener('mouseenter', ['$event'])
  @HostListener('mouseleave', ['$event'])
  @HostListener('focus', ['$event'])
  @HostListener('blur', ['$event'])
  dispatchAnEvent(event: Event) {
    //console.log("dispatch: "+event.type);
    this.keyBinder.dispatchEvent(event);
  }
}
