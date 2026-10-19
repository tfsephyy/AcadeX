<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class BootstrapAdmin extends Command
{
    protected $signature = 'acadex:bootstrap-admin';
    protected $description = 'Interactively create the first administrator without default credentials.';

    public function handle(): int
    {
        if (!$this->input->isInteractive()) {
            $this->error('Interactive input is required. Never pass passwords as command arguments.');
            return self::FAILURE;
        }
        if (User::whereHas('role', fn ($q) => $q->where('name', 'admin'))->exists()) {
            $this->error('An administrator already exists. This command never overwrites existing accounts.');
            return self::FAILURE;
        }

        $data = [
            'name' => $this->ask('Administrator name'),
            'username' => $this->ask('Administrator username'),
            'email' => strtolower(trim((string) $this->ask('Verified administrator email'))),
            'id_number' => $this->ask('Institutional ID'),
            'password' => $this->secret('Password (at least 12 characters, upper/lower case, number and symbol)'),
            'password_confirmation' => $this->secret('Confirm password'),
        ];
        $validator = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:100', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'id_number' => ['required', 'string', 'max:255', 'unique:users,id_number'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) $this->error($error);
            return self::FAILURE;
        }
        if (!$this->confirm('Have you verified this operator identity and email through the university-approved process?')) {
            return self::FAILURE;
        }

        DB::transaction(function () use ($data) {
            $role = Role::firstOrCreate(['name' => 'admin']);
            Role::whereKey($role->id)->lockForUpdate()->firstOrFail();
            if (User::where('role_id', $role->id)->exists()) {
                throw new \RuntimeException('An administrator was created concurrently. No account changed.');
            }
            unset($data['password_confirmation']);
            User::create($data + ['role_id' => $role->id, 'is_approved' => true])
                ->forceFill(['email_verified_at' => now()])->save();
        });
        $this->info('Administrator created. No password has been printed or saved in configuration.');
        return self::SUCCESS;
    }
}
