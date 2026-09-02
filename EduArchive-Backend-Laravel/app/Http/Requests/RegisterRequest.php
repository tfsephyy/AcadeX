<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isVisitor = $this->input('role') === 'visitor';

        $rules = [
            'name'      => ['required', 'string', 'max:255'],
            'username'  => ['required', 'string', 'max:100', 'unique:users,username'],
            'email'     => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'id_number' => $isVisitor
                ? ['nullable', 'string', 'unique:users,id_number', 'regex:/^MBC\d{4}-\d{5}$/']
                : ['required', 'string', 'unique:users,id_number', 'regex:/^MBC\d{4}-\d{5}$/'],
            'role' => ['required', 'string', 'in:student,faculty,visitor'],
            'password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
                'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/',
            ],
        ];

        // Conditional student profile fields
        if ($this->input('role') === 'student') {
            $rules['program'] = ['required', 'string', 'max:255'];
            $rules['year']    = ['required', 'string', 'max:50'];
            $rules['section'] = ['required', 'string', 'max:50'];
        }

        // Conditional faculty profile fields
        if ($this->input('role') === 'faculty') {
            $rules['program'] = ['required', 'string', 'in:BSIT,BSCpE'];
        }

        // Visitor: no academic fields required

        return $rules;
    }

    public function messages(): array
    {
        return [
            'id_number.regex'  => 'The ID number must follow the format MBC2023-00148.',
            'password.regex'   => 'Password must include uppercase, lowercase, and a number.',
            'role.in'          => 'Role must be student, faculty, or visitor.',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Validation failed.',
            'errors'  => $validator->errors(),
        ], 422));
    }
}
