<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UploadTransfer extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected $attributes = ['received_bytes' => 0];
    protected $hidden = ['chunks'];
    protected $casts = ['chunks' => 'array', 'expires_at' => 'datetime', 'size' => 'integer', 'received_bytes' => 'integer'];
}
