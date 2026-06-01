<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rate_card_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rate_card_id')->constrained('rate_cards')->cascadeOnDelete();
            $table->string('zone', 10);
            $table->decimal('weight_from', 8, 3);
            $table->decimal('weight_to', 8, 3);
            $table->decimal('price_per_kg', 10, 4);
            $table->decimal('base_rate', 10, 4);
            $table->timestamps();

            $table->index(['rate_card_id', 'zone', 'weight_from', 'weight_to']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rate_card_items');
    }
};
