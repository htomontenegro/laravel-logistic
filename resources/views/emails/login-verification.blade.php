@component('mail::message')
# Login Verification

Someone is attempting to log in to your account from an unfamiliar location or device.

Your verification code is:

@component('mail::panel')
# {{ $code }}
@endcomponent

This code expires in 10 minutes. If you did not attempt to log in, please change your password immediately.

Thanks,
{{ config('app.name') }}
@endcomponent