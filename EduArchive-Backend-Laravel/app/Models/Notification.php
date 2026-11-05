<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'admin_id',
        'type',
        'dedupe_key',
        'title',
        'message',
        'related_user_id',
        'related_capstone_id',
        'related_upload_id',
        'is_read',
        'email_sent_at',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'email_sent_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public function relatedUser()
    {
        return $this->belongsTo(User::class, 'related_user_id');
    }

    public function relatedCapstone()
    {
        return $this->belongsTo(Capstone::class, 'related_capstone_id');
    }
}
