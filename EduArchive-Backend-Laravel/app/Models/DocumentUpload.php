<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentUpload extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'user_id', 'purpose', 'path', 'capstone_id', 'expires_at'];
    protected $hidden = ['path'];
    protected $casts = ['expires_at' => 'datetime'];
}
