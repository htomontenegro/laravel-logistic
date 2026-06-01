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
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments');
            $table->foreignId('carrier_id')->constrained('carriers');
            $table->foreignId('rate_card_item_id')->constrained('rate_card_items');
            $table->decimal('base_rate', 10, 4);
            $table->decimal('weight_cost', 10, 4);
            $table->decimal('distance_cost', 10, 4);
            $table->decimal('margin', 10, 4);
            $table->decimal('total_price', 10, 4);
            $table->timestamp('calculated_at');
            $table->timestamp('created_at')->nullable();
        });

        DB::statement('ALTER TABLE quotes ADD CONSTRAINT quotes_total_price_positive CHECK (total_price > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('quotes');
    }
};
