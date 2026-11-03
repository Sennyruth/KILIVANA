import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '../../../core/services/auth';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  let fixture: ComponentFixture<ForgotPassword>;
  let forgotPassword: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    forgotPassword = vi.fn(() =>
      of({
        success: true,
        message: 'Success',
        data: 'If the account exists and email delivery is available, reset instructions will be sent.',
      }),
    );

    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            loading: signal(false),
            error: signal(null),
            forgotPassword,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPassword);
  });

  it('shows the backend confirmation without claiming an email was sent', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.form.controls.email.setValue('buyer@example.com');
    component.onSubmit();
    fixture.detectChanges();

    expect(forgotPassword).toHaveBeenCalledWith('buyer@example.com');
    expect(fixture.nativeElement.textContent).toContain(
      'If the account exists and email delivery is available, reset instructions will be sent.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('has been sent to your email');
  });
});
