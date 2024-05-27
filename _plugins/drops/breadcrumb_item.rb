module Jekyll
   module Drops
     class BreadcrumbItem < Liquid::Drop
       extend Forwardable
 
       def initialize(side)
         @side = side
       end
 
       def position
         @side[:position]
       end

       def rootimage
         @side[:root_image]
       end

       def page
         @side[:page]
       end
     end
   end
 end
 
