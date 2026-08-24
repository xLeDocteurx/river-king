import { TestBed } from '@angular/core/testing';
import { StatusBarService } from './status-bar.service';

describe('StatusBarService', () => {
  it('starts with an empty context label', () => {
    const service = TestBed.inject(StatusBarService);
    expect(service.context()).toBe('');
  });

  it('updates the context label', () => {
    const service = TestBed.inject(StatusBarService);
    service.setContext('3 projects');
    expect(service.context()).toBe('3 projects');
  });
});
