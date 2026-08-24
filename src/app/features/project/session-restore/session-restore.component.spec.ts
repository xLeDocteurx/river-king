import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionRestoreComponent } from './session-restore.component';
import { SessionService } from '../../../core/services/session.service';
import type { Session } from '../../../shared/models/session.model';

describe('SessionRestoreComponent', () => {
  let fixture: ComponentFixture<SessionRestoreComponent>;
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let getSession: ReturnType<typeof vi.fn>;

  function setup(session: Partial<Session> | undefined): void {
    getSession = vi.fn().mockResolvedValue(session);
    TestBed.configureTestingModule({
      imports: [SessionRestoreComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { parent: { snapshot: { paramMap: { get: () => 'p1' } } }, snapshot: {} },
        },
        { provide: SessionService, useValue: { getSession } },
      ],
    });
    fixture = TestBed.createComponent(SessionRestoreComponent);
    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  it('redirects to the sprites screen with the stored sprite id', async () => {
    setup({ projectId: 'p1', lastScreen: 'sprites', lastSpriteId: 42 } as Session);
    await fixture.componentInstance.ngOnInit();

    expect(getSession).toHaveBeenCalledWith('p1');
    expect(navigateSpy).toHaveBeenCalledWith(
      ['sprites', 42],
      expect.objectContaining({ replaceUrl: true }),
    );
  });

  it('redirects to the tiles screen with the stored tile id', async () => {
    setup({ projectId: 'p1', lastScreen: 'tiles', lastTileId: 9 } as Session);
    await fixture.componentInstance.ngOnInit();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['tiles', 9],
      expect.objectContaining({ replaceUrl: true }),
    );
  });

  it('redirects to the scenes screen without an element segment', async () => {
    setup({ projectId: 'p1', lastScreen: 'scenes', lastSceneId: 'scene-1' } as Session);
    await fixture.componentInstance.ngOnInit();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['scenes'],
      expect.objectContaining({ replaceUrl: true }),
    );
  });

  it('falls back to the scenes screen when no session exists', async () => {
    setup(undefined);
    await fixture.componentInstance.ngOnInit();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['scenes'],
      expect.objectContaining({ replaceUrl: true }),
    );
  });
});
