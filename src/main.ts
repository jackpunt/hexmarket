import { enableProdMode, importProvidersFrom } from '@angular/core';


import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { KeyBinder } from '@thegraid/easeljs-lib';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(BrowserModule, AppRoutingModule),
        KeyBinder
    ]
})
  .catch(err => console.error(err));
