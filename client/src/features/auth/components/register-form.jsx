/**
 * @file client/src/features/auth/components/register-form.jsx
 * @description User registration form with strict validation.
 * * Validations:
 * - SSN User ID: ^[0-9]{3}-[0-9]{2}-[0-9]{4}$
 * - State: Must be valid US state abbreviation.
 * - ZIP: 5 digits or 5-4.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import StatusBanner from '@/components/status-banner';
import LoadingSpinner from '@/components/loading-spinner';

// Basic US State list for validation
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

const SSN_REGEX = /^[0-9]{3}-[0-9]{2}-[0-9]{4}$/;
const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

export default function RegisterForm() {
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    userId: '', // SSN format
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    profileImageUrl: '',
    // Simulated Payment Data
    paymentBrand: 'VISA',
    paymentLast4: '4242',
    paymentMethodToken: `tok_${Math.random().toString(36).substr(2, 9)}` // Auto-generated for demo
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Auto-formatting for SSN (simple UX enhancement)
    if (name === 'userId' && value.length > formData.userId.length) {
      // Adding chars
      if (value.length === 3 || value.length === 6) {
        setFormData(prev => ({ ...prev, [name]: value + '-' }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validateForm = () => {
    // 1. SSN Validation
    if (!SSN_REGEX.test(formData.userId)) {
      return { code: 'invalid_user_id', message: 'User ID must match SSN format (XXX-XX-XXXX).' };
    }

    // 2. State Validation
    if (!US_STATES.includes(formData.state.toUpperCase())) {
      return { code: 'malformed_state', message: 'Please enter a valid 2-letter US state code.' };
    }

    // 3. Zip Validation
    if (!ZIP_REGEX.test(formData.zip)) {
      return { code: 'malformed_zip', message: 'ZIP code must be 5 digits or ZIP+4.' };
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side validation checks
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Clean up state to be uppercase for consistency
      const payload = {
        ...formData,
        state: formData.state.toUpperCase()
      };
      
      await register(payload);
      // On success, redirect to search or home
      navigate('/search');
    } catch (err) {
      console.error("Registration error:", err);
      const code = err.code || 'registration_failed';
      const message = err.message || 'Failed to register.';
      setError({ code, message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
          
          {/* Personal Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="firstName">First Name</label>
              <Input id="firstName" name="firstName" required value={formData.firstName} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="lastName">Last Name</label>
              <Input id="lastName" name="lastName" required value={formData.lastName} onChange={handleChange} />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="userId">User ID (SSN Format)</label>
            <Input 
              id="userId" 
              name="userId" 
              placeholder="000-00-0000" 
              required 
              value={formData.userId} 
              onChange={handleChange} 
              maxLength={11}
            />
            <p className="text-[0.8rem] text-muted-foreground">Format: XXX-XX-XXXX</p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <Input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <Input id="password" name="password" type="password" required value={formData.password} onChange={handleChange} />
          </div>
          
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="phone">Phone</label>
            <Input id="phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange} />
          </div>

          {/* Address */}
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="address">Address</label>
            <Input id="address" name="address" required value={formData.address} onChange={handleChange} />
          </div>

          <div className="grid grid-cols-6 gap-2">
            <div className="col-span-3 grid gap-2">
              <label className="text-sm font-medium" htmlFor="city">City</label>
              <Input id="city" name="city" required value={formData.city} onChange={handleChange} />
            </div>
            <div className="col-span-1 grid gap-2">
              <label className="text-sm font-medium" htmlFor="state">State</label>
              <Input id="state" name="state" placeholder="NY" maxLength={2} required value={formData.state} onChange={handleChange} className="uppercase" />
            </div>
            <div className="col-span-2 grid gap-2">
              <label className="text-sm font-medium" htmlFor="zip">ZIP</label>
              <Input id="zip" name="zip" required value={formData.zip} onChange={handleChange} />
            </div>
          </div>
          
          <div className="grid gap-2">
             <label className="text-sm font-medium" htmlFor="profileImageUrl">Profile Image URL (Optional)</label>
             <Input id="profileImageUrl" name="profileImageUrl" value={formData.profileImageUrl} onChange={handleChange} placeholder="https://..." />
          </div>

          {/* Simulated Payment */}
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
             <p className="font-semibold mb-1">Simulated Payment Method</p>
             <p>A default payment token will be generated for this account (Visa ending in 4242).</p>
          </div>

          {error && (
            <StatusBanner 
              status="error" 
              message={error.message} 
              code={error.code} 
            />
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </div>
      </form>
      
      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link to="/auth/login" className="underline underline-offset-4 hover:text-primary">
          Sign in
        </Link>
      </div>
    </div>
  );
}