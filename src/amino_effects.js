function WorkTile(left,top,width,height, src, dst) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
    this.src = src;
    this.dst = dst;
    this.srcData = null;
    this.getData = function() {
        if(this.srcData == null) {
            this.srcData = this.src.getContext().getImageData(this.left,this.top,this.width,this.height);
        }
        return this.srcData;
    };
    this.getR = function(x,y) {
        var pi = x+y*this.width;
        return this.srcData.data[pi*4+0];
    };
    this.getG = function(x,y) {
        var pi = x+y*this.width;
        return this.srcData.data[pi*4+1];
    };
    this.getB = function(x,y) {
        var pi = x+y*this.width;
        return this.srcData.data[pi*4+2];
    };
    this.getA = function(x,y) {
        var pi = x+y*this.width;
        return this.srcData.data[pi*4+3];
    };
    this.saveData = function() {
        dst.getContext().putImageData(this.srcData,this.left,this.top);
    }        
    return true;
}


/*
@class SaturationNode A parent node which adjusts the saturation of its child. Uses a buffer internally.
#category effects
@end
*/
function SaturationNode(n) {
    Node.call(this);
	this.node = n;
    this.node.setParent(this);
    this.buf1 = null;
    this.buf2 = null;
    
    //@property saturation value between 0 and 1
    this.saturation = 0.5;
    this.setSaturation = function(s) {
        this.saturation = s;
        this.setDirty();
        return this;
    };
    this.getSaturation = function() {
        return this.saturation;
    };
    var self = this;
    this.draw = function(ctx) {
        var bounds = this.node.getVisualBounds();
        if(!this.buf1) {
            this.buf1 = new Buffer(
                bounds.getWidth()
                ,bounds.getHeight()
                );
            this.buf2 = new Buffer(
                bounds.getWidth()
                ,bounds.getHeight()
                );
        }
        
        //redraw the child only if it's dirty
        if(this.isDirty()) {
            //render child into first buffer
            this.buf1.clear();
            var ctx1 = this.buf1.getContext();
            ctx1.save();
            ctx1.translate(
                -bounds.getX()
                ,-bounds.getY());
            this.node.draw(ctx1);
            ctx1.restore();

            //apply affect from buf1 into buf2
            this.buf2.clear();
            this.applyEffect(this.buf1,this.buf2,5);
            //buf1->buf2
        }
        ctx.save();
        ctx.translate(bounds.getX(),bounds.getY());
        ctx.drawImage(this.buf2.buffer,0,0);
        ctx.restore();
        
        this.clearDirty();
    };
    this.applyEffect = function(buf, buf2, radius) {
        console.log("buf = " + buf + " "+ buf.getWidth());
        var data = buf.getData();
        var s = radius*2;
        var size = 0;
        var scale = 1-this.getSaturation();
        for(var x = 0+size; x<buf.getWidth()-size; x++) {
            for(var y=0+size; y<buf.getHeight()-size; y++) {
                var r = buf.getR(data,x,y);
                var g = buf.getG(data,x,y);
                var b = buf.getB(data,x,y);
                var a = buf.getA(data,x,y);
                //var avg = (r+g+b)/3;
                var v = r*0.21+g*0.71+b*0.07;
                r = r*(1-scale)+v*scale;
                g = g*(1-scale)+v*scale;
                b = b*(1-scale)+v*scale;
                buf2.setRGBA(data,x,y,r,g,b,a);
            }
        }
        /*
        for(var i = 0; i<buf2.getHeight(); i++) {
            buf2.setRGBA(data,0,i,0xFF,0xFF,0xFF,0xFF);
            buf2.setRGBA(data,buf2.getWidth()-1,i,0xFF,0xFF,0xFF,0xFF);
        }
        for(var i = 0; i<buf2.getWidth(); i++) {
            buf2.setRGBA(data,i,0,0xFF,0xFF,0xFF,0xFF);
            buf2.setRGBA(data,i,buf2.getHeight()-1,i,0xFF,0xFF,0xFF,0xFF);
        }
        */
        buf2.setData(data);        
    };
    return true;
}
SaturationNode.extend(AminoNode);



/*
@class BackgroundSaturationNode A parent node which adjusts the saturation of its child. Uses a buffer internally.
#category effects
@end
*/
function BackgroundSaturationNode(n) {
    AminoNode.call(this);
	this.node = n;
    this.node.setParent(this);
    this.buf1 = null;
    this.buf2 = null;
    
    //@property x left edge of the node
    this.x = 0;
    this.setX = function(x) {
        this.x = x;
        return this;
    };
    //@property y top edge of the node
    this.y = 0;
    this.setY = function(y) {
        this.y = y;
        return this;
    };
    
    //@property saturation value between 0 and 1
    this.saturation = 0.5;
    this.setSaturation = function(s) {
        this.saturation = s;
        if(this.saturation > 1.0) this.saturation = 1.0;
        if(this.saturation < 0.0) this.saturation = 0.0;
        this.setDirty();
        return this;
    };
    this.getSaturation = function() {
        return this.saturation;
    };
    
    //@property brightness value between -1 and 1
    this.brightness = 0;
    this.setBrightness = function(b) {
        this.brightness = b;
        if(this.brightness < -1.0) this.brightness = -1.0;
        if(this.brightness > 1.0) this.brightness = 1.0;
        this.setDirty();
        return this;
    };
    this.getBrightness = function() { return this.brightness; };

    //@property contrast value between 0 and 10. default is 1
    this.contrast = 0;
    this.setContrast = function(c) {
        this.contrast = c;
        if(this.contrast < 0.0) this.contrast = 0.0;
        if(this.contrast > 10.0) this.contrast = 10.0;
        this.setDirty();
        return this;
    };
    this.getContrast = function() { return this.contrast; }
        
    
    this.inProgress = false;
    this.workX = 0;
    this.workY = 0;
    this.startTime = 0;
    
    var self = this;
    this.draw = function(ctx) {
        var bounds = this.node.getVisualBounds();
        if(!this.buf1 || bounds.getWidth() != this.buf1.getWidth()) {
            this.buf1 = new Buffer(
                bounds.getWidth()
                ,bounds.getHeight()
                );
            this.buf2 = new Buffer(
                bounds.getWidth()
                ,bounds.getHeight()
                );
        }
        
        //redraw the child only if it's dirty
        if(this.isDirty()) {
            this.startTime = new Date().getTime();
            //render child into first buffer
            this.buf1.clear();
            var ctx1 = this.buf1.getContext();
            ctx1.save();
            ctx1.translate(
                -bounds.getX()
                ,-bounds.getY());
            this.node.draw(ctx1);
            ctx1.restore();

            //apply affect from buf1 into buf2
            //this.buf2.clear();
            //console.log("marking in progress again");
            this.workX = 0;
            this.workY = 0;
            this.inProgress = true;
        }
        
        if(this.inProgress) {
            var start = new Date().getTime();
            while(new Date().getTime()-start < 1000/40) {
                var workSize = 32;
                
                var workW = workSize;
                if(this.workX+workW > this.buf1.getWidth()) {
                    workW = this.buf1.getWidth()-this.workX;
                }
                var workH = workSize;
                if(this.workY+workH > this.buf1.getHeight()) {
                    workH = this.buf1.getHeight()-this.workY;
                }
                var tile = new WorkTile(this.workX,this.workY,workW,workH, this.buf1, this.buf2);
                this.applyEffect(tile);
                if(this.workX+workSize > this.buf1.getWidth()) {
                    this.workX = 0;
                    this.workY+=workSize;
                } else {
                    this.workX+=workSize;
                }
                if(this.workY > this.buf1.getHeight()) {
                    this.inProgress = false;
                    var endTime = new Date().getTime();
                    if(bounds.getWidth() > 100) {
                        //win.alert("done!: " + (endTime-this.startTime));
                    }
                    break;
                }
            }
        }
        ctx.save();
        ctx.translate(bounds.getX()+self.x,bounds.getY()+self.y);
        ctx.drawImage(this.buf2.buffer,0,0);
        ctx.restore();
        
        this.clearDirty();
    };
    
    this.applyEffect = function(tile) {
        var buf = tile.src;
        var buf2 = tile.dst;
        var workSize = tile.width;
        var data = tile.getData();
        var d = data.data;
        
        var tw = tile.width;
        var th = tile.height;
        
        var scale = 1-this.getSaturation();
        var bright = this.getBrightness()*256;
        var contrast = this.getContrast();
        var scale1 = 1-scale;
        var r = 0;
        var g = 0;
        var b = 0;
        var a = 0;
        for(var x=0; x<tw; x++) {
            for(var y=0; y<th; y++) {
                var pi = (x+y*tw)*4;
                r = d[pi+0];
                g = d[pi+1];
                b = d[pi+2];
                a = d[pi+3];
                var v = r*0.21+g*0.71+b*0.07;
                var vs = v*scale;
                r = r*scale1+vs;
                g = g*scale1+vs;
                b = b*scale1+vs;
                //brightness
                r += bright;
                g += bright;
                b += bright;
                //contrast
                r = (r-0x7F)*contrast+0x7F;
                g = (g-0x7F)*contrast+0x7F;
                b = (b-0x7F)*contrast+0x7F;
                //clamp
                if(r > 0xFF) r = 0xFF;
                if(g > 0xFF) g = 0xFF;
                if(b > 0xFF) b = 0xFF;
                if(r < 0x00) r = 0x00;
                if(g < 0x00) g = 0x00;
                if(b < 0x00) b = 0x00;
                
                a = 0xFF;
                d[pi+0] = r;
                d[pi+1] = g;
                d[pi+2] = b;
                d[pi+3] = a;
            }
        }
        tile.saveData();
    };
    return true;
}
BackgroundSaturationNode.extend(AminoNode);

/*
@class BlurNode A parent node which blurs its child.
#category effects
@end
*/
function BlurNode(n) {
	this.node = n;
	console.log("n = " + n);
    AminoNode.call(this);
    if(n) n.setParent(this);
    this.buf1 = null;
    this.buf2 = null;
    
    //@property blurRadius the radius of the blur
    this.blurRadius = 3;
    this.setBlurRadius = function(r) { this.blurRadius = r; return this; }
    
    var self = this;
    this.draw = function(ctx) {
        var bounds = this.node.getVisualBounds();
        if(!this.buf1) {
            this.buf1 = new Buffer(
                bounds.getWidth()+this.blurRadius*4
                ,bounds.getHeight()+this.blurRadius*4
                );
            this.buf2 = new Buffer(
                bounds.getWidth()+this.blurRadius*4
                ,bounds.getHeight()+this.blurRadius*4
                );
        }
        
        //redraw the child only if it's dirty
        if(this.isDirty()) {
            //render child into first buffer
            this.buf1.clear();
            var ctx1 = this.buf1.getContext();
            ctx1.save();
            ctx1.translate(
                -bounds.getX()+this.blurRadius*2
                ,-bounds.getY()+this.blurRadius*2);
            this.node.draw(ctx1);
            ctx1.restore();

            //apply affect from buf1 into buf2
            this.buf2.clear();
            this.applyEffect(this.buf1,this.buf2,this.blurRadius);
            //buf1->buf2
        }
        ctx.save();
        ctx.translate(bounds.getX(),bounds.getY());
        ctx.drawImage(this.buf2.buffer,0,0);
        ctx.restore();
        
        this.clearDirty();
    };
    this.applyEffect = function(buf, buf2, radius) {
        var data = buf.getData();
        var s = radius*2;
        var size = s/2;
        for(var x = 0+size; x<buf.getWidth()-size; x++) {
            for(var y = 0+size; y<buf.getHeight()-size; y++) {
                var r = 0;
                var g = 0;
                var b = 0;
                var a = 0;
                for(var ix=x-size; ix<=x+size; ix++) {
                    for(var iy=y-size;iy<=y+size;iy++) {
                        r += buf.getR(data,ix,iy);
                        g += buf.getG(data,ix,iy);
                        b += buf.getB(data,ix,iy);
                        a += buf.getA(data,ix,iy);
                    }
                }
                var divisor = s*s;
                r = r/divisor;
                g = g/divisor;
                b = b/divisor;
                a = a/divisor;
                //r = 0x00; g = 0x00; b = 0x00;
                a// = a*this.blurOpacity;
                buf2.setRGBA(data,x,y,r,g,b,a);                
            }
        }
        
        /*
        for(var x = 0+size; x<buf.getWidth()-size; x++) {
            for(var y=0+size; y<buf.getHeight()-size; y++) {
                var r = buf.getR(data,x,y);
                var g = buf.getG(data,x,y);
                var b = buf.getB(data,x,y);
                var a = buf.getA(data,x,y);
                buf2.setRGBA(data,x,y,r,g,b,a);
            }
        }
        */
        
        /*
        for(var i = 0; i<buf2.getHeight(); i++) {
            buf2.setRGBA(data,0,i,0xFF,0xFF,0xFF,0xFF);
            buf2.setRGBA(data,buf2.getWidth()-1,i,0xFF,0xFF,0xFF,0xFF);
        }
        for(var i = 0; i<buf2.getWidth(); i++) {
            buf2.setRGBA(data,i,0,0xFF,0xFF,0xFF,0xFF);
            buf2.setRGBA(data,i,buf2.getHeight()-1,i,0xFF,0xFF,0xFF,0xFF);
        }
        */
        
        buf2.setData(data);        
    };
    return true;
};
BlurNode.extend(AminoNode);

/*
@class ShadowNode A parent node which draws a shadow under its child. Uses a buffer internally.
#category effects
@end
*/
function ShadowNode(n) {
    console.log("initing shadow node");
	BlurNode.call(this,n);
	
	//@property offsetX The X offset of the shadow
    this.offsetX = 0;
    this.setOffsetX = function(x) { this.offsetX = x; return this; }
    
    //@property offsetY The Y offset of the shadow
    this.offsetY = 0;
    this.setOffsetY = function(y) { this.offsetY = y; return this; }
    
    //@property blurRadius The radius of the shadow area
    this.blurRadius = 3;
    this.setBlurRadius = function(r) { this.blurRadius = r; return this; }
    
    //@property blurOpacity The opacity of the shadow
    this.blurOpacity = 0.8;
    this.setBlurOpacity = function(r) { this.blurOpacity = r; return this; }
    
    var self = this;
    this.draw = function(ctx) {
        var bounds = this.node.getVisualBounds();
        if(!this.buf1) {
            this.buf1 = new Buffer(
                bounds.getWidth()+this.offsetX+this.blurRadius*4
                ,bounds.getHeight()+this.offsetY+this.blurRadius*4
                );
            this.buf2 = new Buffer(
                bounds.getWidth()+this.offsetX+this.blurRadius*4
                ,bounds.getHeight()+this.offsetY+this.blurRadius*4
                );
        }
        //redraw the child only if it's dirty
        if(this.isDirty()) {
            //render child into first buffer
            this.buf1.clear();
            var ctx1 = this.buf1.getContext();
            ctx1.save();
            ctx1.translate(
                -bounds.getX()+this.blurRadius*2
                ,-bounds.getY()+this.blurRadius*2);
            ctx1.translate(this.offsetX,this.offsetY);
            this.node.draw(ctx1);
            ctx1.restore();

            //apply affect from buf1 into buf2
            this.buf2.clear();
            //buf1->buf2
            this.applyEffect(this.buf1,this.buf2,this.blurRadius);
            
            
            //draw child over blur in buf2
            var ctx2 = this.buf2.getContext();
            ctx2.save();
            ctx2.translate(
                -bounds.getX()+this.blurRadius*2
                ,-bounds.getY()+this.blurRadius*2);
            this.node.draw(ctx2);
            ctx2.restore();
        }
        ctx.save();
        ctx.translate(bounds.getX(),bounds.getY());
        ctx.drawImage(this.buf2.buffer,0,0);
        ctx.restore();
        this.clearDirty();
    };
    
    this.applyEffect = function(buf, buf2, radius) {
        var data = buf.getData();
        var s = radius*2;
        var size = s/2;
        
        for(var x = 0+size; x<buf.getWidth()-size; x++) {
            for(var y = 0+size; y<buf.getHeight()-size; y++) {
                var r = 0;
                var g = 0;
                var b = 0;
                var a = 0;
                for(var ix=x-size; ix<=x+size; ix++) {
                    for(var iy=y-size;iy<=y+size;iy++) {
                        r += buf.getR(data,ix,iy);
                        g += buf.getG(data,ix,iy);
                        b += buf.getB(data,ix,iy);
                        a += buf.getA(data,ix,iy);
                    }
                }
                var divisor = s*s;
                r = r/divisor;
                g = g/divisor;
                b = b/divisor;
                a = a/divisor;
                r = 0x00; g = 0x00; b = 0x00;
                a = a*this.blurOpacity;
                buf2.setRGBA(data,x,y,r,g,b,a);                
            }
        }
        buf2.setData(data);        
    };
    return true;
};
ShadowNode.extend(BlurNode);




/*
@class Buffer An offscreen area that you can draw into. Used for special effects and caching.
#category effects
@end
*/
function Buffer(w,h) {
    var self = this;    
    //@property width  The width of the buffer, set at creation time.
    this.w = w;
    this.getWidth = function() { return this.w; }
    
    //@property height  The height of the buffer, set at creation time.
    this.h = h;
    this.getHeight = function() { return this.h; }
    
    this.buffer = document.createElement("canvas");
    this.buffer.width = this.w;
    this.buffer.height = this.h;
    
    //@doc get the Canvas 2D context of the buffer, so you can draw on it
    this.getContext = function() { return self.buffer.getContext('2d'); }
    
    //@doc Get an canvas ImageData structure.
    this.getData = function() {
        var c = this.getContext();
        var data = c.getImageData(0,0,this.getWidth(), this.getHeight());
        return data;
    };
    
    //@method Return the *red* component at the specified x and y.
    this.getR = function(data, x, y) {
        var pi = x+y*data.width;
        return data.data[pi*4+0];
    };
    
    //@method Return the *green* component at the specified x and y.
    this.getG = function(data, x, y) {
        var pi = x+y*data.width;
        return data.data[pi*4+1];
    };
    
    //@method Return the *blue* component at the specified x and y.
    this.getB = function(data, x, y) {
        var pi = x+y*data.width;
        return data.data[pi*4+2];
    };
    
    //@method Return the *alpha* component at the specified x and y.
    this.getA = function(data, x, y) {
        var pi = x+y*data.width;
        return data.data[pi*4+3];
    };
    
    //@method Set the red, green, blue, and alpha components at the specified x and y.
    this.setRGBA = function(data,x,y,r,g,b,a) {
        var pi = (x+y*this.getWidth())*4;
        //console.log("pi = " + pi);
        data.data[pi+0] = r; //alpha
        data.data[pi+1] = g; //red
        data.data[pi+2] = b; //green
        data.data[pi+3] = a; //blue
        return this;
    };
    //@method Set the data structure back into the canvas. This should be the same value you got from *getData()*.
    this.setData = function(data) {
        this.getContext().putImageData(data,0,0);
        return this;
    };
    //@method Clear the buffer with transparent black.
    this.clear = function() {
        var ctx = this.getContext();
        ctx.clearRect(0,0,this.getWidth(),this.getHeight());
        return this;
    };
    return true;
};

/* 
@class BufferNode A node which draws its child into a buffer. Use it to cache children which are expensive to draw.
#category effects
@end
*/
function BufferNode(n) {
	AminoNode.call(this);
	this.node = n;
    this.node.setParent(this);
    this.buf = null;
    var self = this;
    this.draw = function(ctx) {
        var bounds = this.node.getVisualBounds();
        if(!this.buf) {
            this.buf = new Buffer(bounds.getWidth(),bounds.getHeight());
        }
        //redraw the child only if it's dirty
        if(this.isDirty()) {
            var ctx2 = this.buf.getContext();
            ctx2.save();
            ctx2.translate(-bounds.getX(),-bounds.getY());
            this.node.draw(ctx2);
            ctx2.restore();
        }
        ctx.save();
        ctx.translate(bounds.getX(),bounds.getY());
        ctx.drawImage(this.buf.buffer,0,0);
        ctx.restore();
        this.clearDirty();
    };
    return true;
};
BufferNode.extend(AminoNode);






function BitmapText(src) {
	this.src = src;
	this.x = 0;
	this.y = 0;
	this.text = "random text";
	return this;
}

BitmapText.prototype.setMetrics = function(metrics) {
	this.metrics = metrics;
	return this;
}
BitmapText.prototype.setLineHeight = function(lineHeight) {
	this.lineHeight = lineHeight;
	return this;
}
BitmapText.prototype.setX = function(x) {
	this.x = x;
	return this;
}
BitmapText.prototype.setY = function(y) {
	this.y = y;
	return this;
}
BitmapText.prototype.paint = function(g) {
	g.fillStyle = "black";
	g.font = "12pt sans-serif";
	g.fillText(this.text,this.x,this.y);
}




