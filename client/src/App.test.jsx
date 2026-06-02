import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
  test('renders login form with email and password inputs', () => {
    render(<App />);
    
    // Check heading
    const heading = screen.getByRole('heading', { name: /welcome back/i });
    expect(heading).toBeInTheDocument();
    
    // Check form inputs
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    
    // Check submit button
    const signInButton = screen.getByRole('button', { name: /sign in/i });
    expect(signInButton).toBeInTheDocument();
  });

  test('renders sign up option', () => {
    render(<App />);
    
    const createAccountButton = screen.getByRole('button', { 
      name: /create new account/i 
    });
    expect(createAccountButton).toBeInTheDocument();
  });
});