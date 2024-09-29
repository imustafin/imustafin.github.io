# frozen_string_literal: true

# Re-render and re-write pages which have 'rewrite_post_write'
# useful for tailwind css purging
if ENV['JEKYLL_ENV'] == 'production'
  Jekyll::Hooks.register :site, :post_write do |site|
    site.pages
      .filter { |x| x.data['rewrite_post_write'] }
      .sort { |x| x.data['rewrite_post_write'] }
      .each do |page|
        page.output = page.renderer.run
        page.write(site.dest)
        puts "Rewrote #{page.path} with rewirite_post_write=#{page.data['rewrite_post_write']}"
      end
  end
end
